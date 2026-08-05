// src/components/Sidebar.jsx
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";

const navItems = [
  {
    key: "home",
    label: "Dashboard",
    icon: "🏠",
  },
  {
  key: "team",
  label: "Team",
  icon: "👔",
  },
  {
    key: "clients",
    label: "Participants",
    icon: "👥",
  },
  {
    key: "documents",
    label: "Documents",
    icon: "📄",
  },
  {
    key: "knowledgeLibrary",
    label: "Knowledge Library",
    icon: "🏛",
  },
  {
    key: "careplan",
    label: "Purpose Plans",
    icon: "🎯",
  },
  {
    key: "insights",
    label: "Insights",
    icon: "📊",
  },
  {
    key: "therapy",
    label: "Therapy",
    icon: "🧠",
  },
  {
    key: "meds",
    label: "Medication",
    icon: "💊",
  },
  {
    key: "staff",
    label: "Staff Notes",
    icon: "📝",
  },
  {
    key: "paramedic",
    label: "Paramedic",
    icon: "🚑",
  },
  {
    key: "vpn",
    label: "Remote Support",
    icon: "🔐",
  },
  {
    key: "knowledge",
    label: "Knowledge Engine",
    icon: "🤖",
  },
  {
    key: "timeline",
    label: "Timeline",
    icon: "🕒",
  },
];

export default function Sidebar({
  selectedZone,
  setSelectedZone,
}) {
  const {
    user,
    userDisplayName,
    signOut,
  } = useAuth();

  const {
    organisationName,
    roleLabel,
    activeWorkspace,
  } = useWorkspace();

  const avatarLetter =
    userDisplayName?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    "U";

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      console.error("Unable to sign out:", error);
      alert(
        error?.message ||
          "Sign out could not be completed."
      );
    }
  }

  return (
    <aside className="pro-sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">TN</div>

        <div>
          <div className="brand-title">
            Theraa Nurse
          </div>

          <div className="brand-subtitle">
            Purpose-Centred Care
          </div>
        </div>
      </div>

      <div className="sidebar-workspace-card">
        <span>Provider workspace</span>

        <strong>
          {organisationName ||
            "No workspace loaded"}
        </strong>

        <small>
          {roleLabel || "Workspace Member"}
        </small>
      </div>

      <div className="sidebar-section-label">
        Workspace
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={
              selectedZone === item.key
                ? "sidebar-nav-item active"
                : "sidebar-nav-item"
            }
            onClick={() =>
              setSelectedZone(item.key)
            }
          >
            <span className="sidebar-icon">
              {item.icon}
            </span>

            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {avatarLetter}
          </div>

          <div className="sidebar-user-info">
            <div className="sidebar-user-label">
              {roleLabel ||
                "Workspace Member"}
            </div>

            <div className="sidebar-user-email">
              {user?.email || "User"}
            </div>

            <div className="sidebar-user-workspace">
              {activeWorkspace
                ? organisationName
                : "No active workspace"}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="sidebar-signout"
          onClick={() => void handleSignOut()}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}