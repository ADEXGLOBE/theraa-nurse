// src/features/workforce/ComplianceDocumentUpload.jsx

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";

import {
  getTeamRoleLabel,
  listOrganisationInvitations,
  listOrganisationMembers,
} from "../../services/teamService";

import {
  uploadComplianceDocument,
} from "../../services/complianceDocumentService";


const DOCUMENT_TYPES = [
  "NDIS Worker Screening",
  "Police Check",
  "Working With Children Check",
  "First Aid",
  "CPR",
  "Medication Assistance",
  "Manual Handling",
  "Behaviour Support Training",
  "Infection Control",
  "Professional Registration",
  "Qualification",
  "Driver Licence",
  "Vehicle Insurance",
  "Professional Indemnity Insurance",
  "Public Liability Insurance",
  "Training Certificate",
  "Other",
];


const EMPTY_FORM = {
  staffUserId: "",
  documentType: "NDIS Worker Screening",
  documentName: "",
  referenceNumber: "",
  issueDate: "",
  expiryDate: "",
  notes: "",
};


function shortId(value) {
  if (!value) {
    return "Unknown";
  }

  return `${String(value).slice(
    0,
    8
  )}…`;
}


export default function ComplianceDocumentUpload({
  onUploaded,
}) {
  const {
    user,
  } = useAuth();

  const {
    organisationId,
    role,
  } = useWorkspace();


  const [
    members,
    setMembers,
  ] = useState([]);


  const [
    invitations,
    setInvitations,
  ] = useState([]);


  const [
    form,
    setForm,
  ] = useState({
    ...EMPTY_FORM,
    staffUserId:
      user?.id || "",
  });


  const [
    file,
    setFile,
  ] = useState(null);


  const [
    loadingMembers,
    setLoadingMembers,
  ] = useState(false);


  const [
    uploading,
    setUploading,
  ] = useState(false);


  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");


  const canUploadForOthers =
    [
      "provider_admin",
      "manager",
      "support_coordinator",
    ].includes(role);


  useEffect(() => {
    if (
      user?.id &&
      !form.staffUserId
    ) {
      setForm(
        (current) => ({
          ...current,
          staffUserId:
            user.id,
        })
      );
    }
  }, [
    user?.id,
    form.staffUserId,
  ]);


  useEffect(() => {
    let cancelled = false;

    async function loadTeam() {
      if (!organisationId) {
        setMembers([]);
        setInvitations([]);
        return;
      }

      setLoadingMembers(true);

      try {
        const [
          loadedMembers,
          loadedInvitations,
        ] =
          await Promise.all([
            listOrganisationMembers(
              organisationId
            ),

            listOrganisationInvitations(
              organisationId
            ),
          ]);

        if (cancelled) {
          return;
        }

        setMembers(
          Array.isArray(
            loadedMembers
          )
            ? loadedMembers
            : []
        );

        setInvitations(
          Array.isArray(
            loadedInvitations
          )
            ? loadedInvitations
            : []
        );
      } catch (error) {
        console.error(
          "Unable to load compliance upload team members:",
          error
        );

        if (!cancelled) {
          setMembers([]);
          setInvitations([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingMembers(false);
        }
      }
    }

    void loadTeam();

    return () => {
      cancelled = true;
    };
  }, [
    organisationId,
  ]);


  const activeMembers =
    useMemo(
      () =>
        members.filter(
          (member) =>
            member.status ===
            "active"
        ),
      [
        members,
      ]
    );


  const memberDirectory =
    useMemo(() => {
      const directory =
        new Map();

      invitations.forEach(
        (invitation) => {
          if (
            invitation.status !==
              "accepted" ||
            !invitation.accepted_by
          ) {
            return;
          }

          directory.set(
            invitation.accepted_by,
            {
              fullName:
                invitation.full_name ||
                "",

              email:
                invitation.email ||
                "",
            }
          );
        }
      );

      return directory;
    }, [
      invitations,
    ]);


  function getMemberDisplayName(
    userId
  ) {
    if (!userId) {
      return "Unknown team member";
    }

    if (
      userId === user?.id
    ) {
      return "You";
    }

    const member =
      activeMembers.find(
        (item) =>
          item.user_id === userId
      );

    const invitation =
      memberDirectory.get(
        userId
      );

    if (
      invitation?.fullName
    ) {
      return invitation.fullName;
    }

    if (
      invitation?.email
    ) {
      return invitation.email;
    }

    if (member?.role) {
      return `${getTeamRoleLabel(
        member.role
      )} · ${shortId(
        userId
      )}`;
    }

    return shortId(
      userId
    );
  }


  function updateForm(
    key,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        [key]:
          value,
      })
    );
  }


  function resetForm() {
    setForm({
      ...EMPTY_FORM,

      staffUserId:
        canUploadForOthers
          ? ""
          : user?.id ||
            "",
    });

    setFile(null);

    const input =
      document.getElementById(
        "theraa-compliance-file-input"
      );

    if (input) {
      input.value = "";
    }
  }


  async function handleUpload(
    event
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");


    if (!organisationId) {
      setErrorMessage(
        "No provider workspace is active."
      );

      return;
    }


    if (!user?.id) {
      setErrorMessage(
        "You must be signed in to upload a compliance document."
      );

      return;
    }


    const targetUserId =
      canUploadForOthers
        ? form.staffUserId
        : user.id;


    if (!targetUserId) {
      setErrorMessage(
        "Select the professional this document belongs to."
      );

      return;
    }


    if (
      !form.documentName.trim()
    ) {
      setErrorMessage(
        "Enter the document or certificate name."
      );

      return;
    }


    if (!file) {
      setErrorMessage(
        "Select a compliance document to upload."
      );

      return;
    }


    setUploading(true);

    try {
      const uploaded =
        await uploadComplianceDocument({
          organisationId,

          userId:
            targetUserId,

          uploadedBy:
            user.id,

          documentType:
            form.documentType,

          documentName:
            form.documentName,

          referenceNumber:
            form.referenceNumber,

          issueDate:
            form.issueDate ||
            null,

          expiryDate:
            form.expiryDate ||
            null,

          notes:
            form.notes,

          file,
        });


      setSuccessMessage(
        "Compliance document uploaded successfully and is awaiting review."
      );


      resetForm();


      if (
        typeof onUploaded ===
        "function"
      ) {
        await onUploaded(
          uploaded
        );
      }
    } catch (error) {
      console.error(
        "Unable to upload compliance document:",
        error
      );

      setErrorMessage(
        error?.message ||
          "The compliance document could not be uploaded."
      );
    } finally {
      setUploading(false);
    }
  }


  return (
    <section className="card premium-card">
      <div className="card-title">
        Upload Compliance Document
      </div>

      <div className="card-subtitle">
        Upload workforce credentials,
        qualifications, registrations and
        compliance evidence to the private
        provider workspace.
      </div>


      {errorMessage ? (
        <div
          className="auth-error"
          style={{
            marginTop: 14,
          }}
        >
          {errorMessage}
        </div>
      ) : null}


      {successMessage ? (
        <div
          className="auth-success"
          style={{
            marginTop: 14,
          }}
        >
          {successMessage}
        </div>
      ) : null}


      <form
        onSubmit={
          handleUpload
        }
        style={{
          display: "grid",
          gap: 12,
          marginTop: 16,
        }}
      >
        {canUploadForOthers ? (
          <label>
            <span>
              Professional
            </span>

            <select
              className="input"
              value={
                form.staffUserId
              }
              onChange={(event) =>
                updateForm(
                  "staffUserId",
                  event.target.value
                )
              }
              disabled={
                loadingMembers
              }
            >
              <option value="">
                Select team member
              </option>

              {activeMembers.map(
                (member) => (
                  <option
                    key={member.id}
                    value={
                      member.user_id
                    }
                  >
                    {getMemberDisplayName(
                      member.user_id
                    )}
                    {" — "}
                    {getTeamRoleLabel(
                      member.role
                    )}
                  </option>
                )
              )}
            </select>
          </label>
        ) : (
          <div
            className="notice-box"
            style={{
              marginBottom: 4,
            }}
          >
            Uploading for:{" "}
            <strong>
              {getMemberDisplayName(
                user?.id
              )}
            </strong>
          </div>
        )}


        <label>
          <span>
            Document Type
          </span>

          <select
            className="input"
            value={
              form.documentType
            }
            onChange={(event) =>
              updateForm(
                "documentType",
                event.target.value
              )
            }
          >
            {DOCUMENT_TYPES.map(
              (documentType) => (
                <option
                  key={
                    documentType
                  }
                  value={
                    documentType
                  }
                >
                  {documentType}
                </option>
              )
            )}
          </select>
        </label>


        <label>
          <span>
            Document / Certificate Name
          </span>

          <input
            className="input"
            value={
              form.documentName
            }
            onChange={(event) =>
              updateForm(
                "documentName",
                event.target.value
              )
            }
            placeholder="e.g. HLTAID011 First Aid Certificate"
          />
        </label>


        <label>
          <span>
            Reference / Registration Number
          </span>

          <input
            className="input"
            value={
              form.referenceNumber
            }
            onChange={(event) =>
              updateForm(
                "referenceNumber",
                event.target.value
              )
            }
            placeholder="Certificate number, registration number or reference"
          />
        </label>


        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "1fr 1fr",
            gap: 10,
          }}
        >
          <label>
            <span>
              Issue Date
            </span>

            <input
              type="date"
              className="input"
              value={
                form.issueDate
              }
              onChange={(event) =>
                updateForm(
                  "issueDate",
                  event.target.value
                )
              }
            />
          </label>


          <label>
            <span>
              Expiry Date
            </span>

            <input
              type="date"
              className="input"
              value={
                form.expiryDate
              }
              onChange={(event) =>
                updateForm(
                  "expiryDate",
                  event.target.value
                )
              }
            />
          </label>
        </div>


        <label>
          <span>
            Compliance File
          </span>

          <input
            id="theraa-compliance-file-input"
            type="file"
            className="input"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            onChange={(event) =>
              setFile(
                event.target.files?.[0] ||
                  null
              )
            }
          />

          <small
            style={{
              display: "block",
              marginTop: 5,
              color: "#6b7280",
            }}
          >
            PDF, JPEG, PNG or WebP. Maximum
            file size: 15 MB.
          </small>
        </label>


        {file ? (
          <div
            className="notice-box"
            style={{
              fontSize: 12,
            }}
          >
            Selected:{" "}
            <strong>
              {file.name}
            </strong>
            {" · "}
            {Math.max(
              1,
              Math.round(
                file.size /
                  1024
              )
            )}
            {" KB"}
          </div>
        ) : null}


        <label>
          <span>
            Notes
          </span>

          <textarea
            className="textarea"
            rows={3}
            value={
              form.notes
            }
            onChange={(event) =>
              updateForm(
                "notes",
                event.target.value
              )
            }
            placeholder="Optional verification information, restrictions or context..."
          />
        </label>


        <div
          className="notice-box"
          style={{
            fontSize: 12,
          }}
        >
          🔒 Files are uploaded to the
          private Theraa Nurse workforce
          compliance storage area. New
          submissions begin as{" "}
          <strong>
            Pending Review
          </strong>
          .
        </div>


        <button
          type="submit"
          className="btn-primary"
          disabled={
            uploading
          }
        >
          {uploading
            ? "Uploading Compliance Document…"
            : "📤 Upload Compliance Document"}
        </button>
      </form>
    </section>
  );
}