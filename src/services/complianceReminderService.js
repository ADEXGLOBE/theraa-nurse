// src/services/complianceReminderService.js

import {
  getComplianceExpiryState,
  listComplianceDocuments,
} from "./complianceDocumentService";

import {
  createWorkforceReminder,
  listWorkforceReminders,
  updateWorkforceReminder,
} from "./reminderService";


const COMPLIANCE_REMINDER_TYPE =
  "compliance";


/*
 * This marker lets Theraa Nurse identify
 * reminders that were generated automatically
 * from a specific compliance document.
 *
 * We store it inside the reminder description
 * because the current workforce_reminders table
 * does not yet have a source_document_id column.
 */
function buildSourceMarker(
  documentId
) {
  return `[TN-COMPLIANCE:${documentId}]`;
}


function clean(value) {
  return String(
    value ?? ""
  ).trim();
}


function formatDate(
  value
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(
      `${value}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}


function getReminderPriority({
  expiryState,
  daysRemaining,
  verificationStatus,
}) {
  /*
   * Rejected documents need prompt action,
   * even if their expiry date is still valid.
   */
  if (
    verificationStatus ===
    "rejected"
  ) {
    return "high";
  }


  if (
    expiryState ===
    "expired"
  ) {
    return "urgent";
  }


  if (
    expiryState ===
      "expiring" &&
    typeof daysRemaining ===
      "number" &&
    daysRemaining <= 7
  ) {
    return "high";
  }


  if (
    expiryState ===
    "expiring"
  ) {
    return "medium";
  }


  return "low";
}


function getReminderDueDate({
  document,
  expiryState,
}) {
  /*
   * Rejected documents should be handled
   * promptly instead of waiting until expiry.
   */
  if (
    document.verificationStatus ===
    "rejected"
  ) {
    const date =
      new Date();

    date.setDate(
      date.getDate() + 3
    );

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(
        2,
        "0"
      );

    const day =
      String(
        date.getDate()
      ).padStart(
        2,
        "0"
      );

    return `${year}-${month}-${day}`;
  }


  /*
   * For expiring / expired credentials,
   * use the actual expiry date.
   */
  if (
    expiryState ===
      "expiring" ||
    expiryState ===
      "expired"
  ) {
    return (
      document.expiryDate ||
      null
    );
  }


  return null;
}


function buildReminderContent({
  document,
  expiry,
}) {
  const documentName =
    clean(
      document.documentName
    ) ||
    clean(
      document.documentType
    ) ||
    "Compliance document";


  const expiryDate =
    formatDate(
      document.expiryDate
    );


  const marker =
    buildSourceMarker(
      document.id
    );


  /*
   * REJECTED DOCUMENT
   */
  if (
    document.verificationStatus ===
    "rejected"
  ) {
    return {
      title:
        `Action required: ${documentName} was rejected`,

      description:
        [
          `${documentName} has been rejected during compliance review.`,

          document.rejectionReason
            ? `Reason: ${document.rejectionReason}`
            : "",

          "Please upload a corrected or replacement document for review.",

          marker,
        ]
          .filter(Boolean)
          .join("\n\n"),
    };
  }


  /*
   * EXPIRED DOCUMENT
   */
  if (
    expiry.state ===
    "expired"
  ) {
    return {
      title:
        `${documentName} has expired`,

      description:
        [
          `${documentName} expired${expiryDate ? ` on ${expiryDate}` : ""}.`,

          "Please provide an updated compliance document as soon as possible.",

          marker,
        ]
          .filter(Boolean)
          .join("\n\n"),
    };
  }


  /*
   * EXPIRING DOCUMENT
   */
  if (
    expiry.state ===
    "expiring"
  ) {
    const remaining =
      typeof expiry.daysRemaining ===
        "number"
        ? expiry.daysRemaining
        : null;


    return {
      title:
        remaining !== null
          ? `${documentName} expires in ${remaining} day${
              remaining === 1
                ? ""
                : "s"
            }`
          : `${documentName} is expiring soon`,

      description:
        [
          `${documentName} ${
            expiryDate
              ? `expires on ${expiryDate}.`
              : "is approaching expiry."
          }`,

          "Please upload a renewed document before the current credential expires.",

          marker,
        ]
          .filter(Boolean)
          .join("\n\n"),
    };
  }


  return null;
}


function findExistingReminder({
  reminders,
  documentId,
}) {
  const marker =
    buildSourceMarker(
      documentId
    );

  return (
    reminders.find(
      (reminder) =>
        String(
          reminder.description ||
            ""
        ).includes(
          marker
        ) &&
        reminder.reminderType ===
          COMPLIANCE_REMINDER_TYPE &&
        reminder.status !==
          "cancelled"
    ) ||
    null
  );
}


function shouldGenerateReminder(
  document
) {
  /*
   * Rejected documents always need
   * corrective action.
   */
  if (
    document.verificationStatus ===
    "rejected"
  ) {
    return true;
  }


  /*
   * Pending documents are awaiting review,
   * so we do not generate an expiry reminder
   * from them yet.
   */
  if (
    document.verificationStatus !==
    "verified"
  ) {
    return false;
  }


  const expiry =
    getComplianceExpiryState(
      document.expiryDate
    );


  return [
    "expiring",
    "expired",
  ].includes(
    expiry.state
  );
}


/* =========================================================
   SYNC ONE COMPLIANCE DOCUMENT
========================================================= */

export async function syncComplianceDocumentReminder({
  organisationId,
  document,
  existingReminders,
  createdBy,
}) {
  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }


  if (!document?.id) {
    throw new Error(
      "Compliance document is required."
    );
  }


  if (!createdBy) {
    throw new Error(
      "Automation user ID is required."
    );
  }


  if (
    !shouldGenerateReminder(
      document
    )
  ) {
    return {
      action:
        "none",

      documentId:
        document.id,

      reminder:
        null,
    };
  }


  const expiry =
    getComplianceExpiryState(
      document.expiryDate
    );


  const content =
    buildReminderContent({
      document,
      expiry,
    });


  if (!content) {
    return {
      action:
        "none",

      documentId:
        document.id,

      reminder:
        null,
    };
  }


  const priority =
    getReminderPriority({
      expiryState:
        expiry.state,

      daysRemaining:
        expiry.daysRemaining,

      verificationStatus:
        document.verificationStatus,
    });


  const dueDate =
    getReminderDueDate({
      document,
      expiryState:
        expiry.state,
    });


  const existing =
    findExistingReminder({
      reminders:
        existingReminders,

      documentId:
        document.id,
    });


  /*
   * -------------------------------------------------------
   * EXISTING REMINDER
   * -------------------------------------------------------
   *
   * Update instead of creating another duplicate.
   *
   * Example:
   *
   * 30 days remaining -> medium
   * 6 days remaining  -> high
   * expired           -> urgent
   */
  if (existing) {
    const updated =
      await updateWorkforceReminder({
        reminderId:
          existing.id,

        organisationId,

        changes: {
          title:
            content.title,

          description:
            content.description,

          assignedUserId:
            document.userId ||
            null,

          reminderType:
            COMPLIANCE_REMINDER_TYPE,

          professionalType:
            "",

          dueDate,

          priority,

          /*
           * If a reminder was previously
           * completed but the credential is
           * now still invalid / expired /
           * rejected, reopen it.
           */
          status:
            existing.status ===
              "completed"
              ? "open"
              : existing.status,
        },
      });


    return {
      action:
        "updated",

      documentId:
        document.id,

      reminder:
        updated,
    };
  }


  /*
   * -------------------------------------------------------
   * CREATE NEW REMINDER
   * -------------------------------------------------------
   */

  const created =
    await createWorkforceReminder({
      organisationId,

      participantId:
        null,

      assignedUserId:
        document.userId ||
        null,

      title:
        content.title,

      description:
        content.description,

      reminderType:
        COMPLIANCE_REMINDER_TYPE,

      professionalType:
        "",

      dueDate,

      priority,

      createdBy,
    });


  return {
    action:
      "created",

    documentId:
      document.id,

    reminder:
      created,
  };
}


/* =========================================================
   SCAN ENTIRE ORGANISATION
========================================================= */

export async function syncOrganisationComplianceReminders({
  organisationId,
  createdBy,
}) {
  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }


  if (!createdBy) {
    throw new Error(
      "Signed-in user ID is required."
    );
  }


  /*
   * Load both sources once.
   */
  const [
    documents,
    reminders,
  ] =
    await Promise.all([
      listComplianceDocuments({
        organisationId,
      }),

      listWorkforceReminders({
        organisationId,
      }),
    ]);


  const results = [];


  for (
    const document of
    documents
  ) {
    try {
      const result =
        await syncComplianceDocumentReminder({
          organisationId,

          document,

          existingReminders:
            reminders,

          createdBy,
        });


      results.push(
        result
      );


      /*
       * Add newly-created reminders
       * to the local array so another
       * document cannot accidentally
       * generate a duplicate during
       * the same scan.
       */
      if (
        result.action ===
          "created" &&
        result.reminder
      ) {
        reminders.push(
          result.reminder
        );
      }


      if (
        result.action ===
          "updated" &&
        result.reminder
      ) {
        const index =
          reminders.findIndex(
            (item) =>
              item.id ===
              result.reminder.id
          );


        if (index >= 0) {
          reminders[index] =
            result.reminder;
        }
      }
    } catch (error) {
      console.error(
        `Unable to generate compliance reminder for document ${document.id}:`,
        error
      );


      results.push({
        action:
          "error",

        documentId:
          document.id,

        reminder:
          null,

        error:
          error?.message ||
          "Unknown compliance reminder error.",
      });
    }
  }


  const summary = {
    scanned:
      documents.length,

    created:
      results.filter(
        (item) =>
          item.action ===
          "created"
      ).length,

    updated:
      results.filter(
        (item) =>
          item.action ===
          "updated"
      ).length,

    unchanged:
      results.filter(
        (item) =>
          item.action ===
          "none"
      ).length,

    errors:
      results.filter(
        (item) =>
          item.action ===
          "error"
      ).length,
  };


  return {
    summary,
    results,
  };
}