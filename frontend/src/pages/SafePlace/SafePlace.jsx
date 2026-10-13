import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTrash,
  faShieldHeart,
  faPaperPlane,
  faEnvelope,
  faUserCheck,
  faCheckSquare,
  faSquare,
  faCircleExclamation,
  faCircleCheck,
  faSpinner
} from "@fortawesome/free-solid-svg-icons";
import { API_URL, sendSosAlert, getSafetyActivities, getSafetyStatus } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import SafetyConsentModal from "../../components/common/SafetyConsentModal.jsx";

function SafePlace() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [userSituationText, setUserSituationText] = useState("");
  
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");

  // Selection state for sending SOS alerts to chosen contacts
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  
  // Status states
  const [sendingSos, setSendingSos] = useState(false);
  const [alertFeedback, setAlertFeedback] = useState(null); // { type: 'success' | 'warning' | 'error', message: '' }
  const [emailConfigured, setEmailConfigured] = useState(true);

  // Load contacts and activities on mount
  useEffect(() => {
    loadContacts();
    loadActivities();
    checkEmailStatus();
  }, []);

  const checkEmailStatus = async () => {
    try {
      const status = await getSafetyStatus();
      setEmailConfigured(status.email_configured);
    } catch {
      setEmailConfigured(false);
    }
  };

  const loadActivities = async () => {
    try {
      const serverActivities = await getSafetyActivities();
      if (serverActivities && serverActivities.length > 0) {
        setActivities(serverActivities);
        return;
      }
    } catch (e) {
      console.warn("Could not fetch safety activities from server:", e);
    }
    const saved = JSON.parse(localStorage.getItem("safetyActivities")) || [];
    setActivities(saved.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
  };

  const loadContacts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/contacts`, {
        credentials: "include",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("mindease_token") || ""}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
        localStorage.setItem("trustedContacts", JSON.stringify(data));
        // Default select all SOS-enabled contacts with valid emails
        const defaultSelected = new Set(
          data
            .filter(c => c.receive_sos !== false && c.email)
            .map(c => c.email.trim().toLowerCase())
        );
        setSelectedEmails(defaultSelected);
        return;
      }
    } catch (e) {
      console.error("Failed to load contacts from API:", e);
    }
    const savedContacts = JSON.parse(localStorage.getItem("trustedContacts")) || [];
    setContacts(savedContacts);
    setSelectedEmails(
      new Set(
        savedContacts
          .filter(c => c.receive_sos !== false && c.email)
          .map(c => c.email.trim().toLowerCase())
      )
    );
  };

  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactEmail.trim()) return;
    
    try {
      const res = await fetch(`${API_URL}/api/contacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("mindease_token") || ""}`
        },
        credentials: "include",
        body: JSON.stringify({
          name: newContactName.trim(),
          email: newContactEmail.trim(),
          receive_sos: true
        })
      });
      if (res.ok) {
        const created = await res.json();
        const updated = [...contacts, created];
        setContacts(updated);
        localStorage.setItem("trustedContacts", JSON.stringify(updated));
        
        // Also add new contact's email to selected list
        setSelectedEmails(prev => new Set([...prev, created.email.trim().toLowerCase()]));

        setNewContactName("");
        setNewContactEmail("");
        return;
      }
    } catch (e) {
      console.error("Failed to save contact to API:", e);
    }

    const newContact = {
      id: Date.now().toString(),
      name: newContactName.trim(),
      email: newContactEmail.trim(),
      receive_sos: true
    };
    const updated = [...contacts, newContact];
    setContacts(updated);
    localStorage.setItem("trustedContacts", JSON.stringify(updated));
    setSelectedEmails(prev => new Set([...prev, newContact.email.trim().toLowerCase()]));
    setNewContactName("");
    setNewContactEmail("");
  };

  const handleDeleteContact = async (id) => {
    try {
      await fetch(`${API_URL}/api/contacts/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("mindease_token") || ""}`
        }
      });
    } catch (e) {
      console.error("Failed to delete contact API:", e);
    }
    const target = contacts.find(c => c.id === id);
    const updated = contacts.filter(c => c.id !== id);
    setContacts(updated);
    localStorage.setItem("trustedContacts", JSON.stringify(updated));
    if (target && target.email) {
      setSelectedEmails(prev => {
        const next = new Set(prev);
        next.delete(target.email.trim().toLowerCase());
        return next;
      });
    }
  };

  const toggleReceiveSos = async (id) => {
    const target = contacts.find(c => c.id === id);
    if (!target) return;
    const newStatus = !target.receive_sos;
    const updated = contacts.map(c => {
      if (c.id === id) {
        return { ...c, receive_sos: newStatus };
      }
      return c;
    });
    setContacts(updated);
    localStorage.setItem("trustedContacts", JSON.stringify(updated));

    if (!newStatus && target.email) {
      setSelectedEmails(prev => {
        const next = new Set(prev);
        next.delete(target.email.trim().toLowerCase());
        return next;
      });
    } else if (newStatus && target.email) {
      setSelectedEmails(prev => new Set([...prev, target.email.trim().toLowerCase()]));
    }

    try {
      await fetch(`${API_URL}/api/contacts/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("mindease_token") || ""}`
        },
        credentials: "include",
        body: JSON.stringify({
          name: target.name,
          email: target.email,
          receive_sos: newStatus
        })
      });
    } catch (e) {
      console.error("Failed to update contact in backend:", e);
    }
  };

  // Toggle selection for an email
  const toggleContactSelection = (email) => {
    const cleanEmail = email.trim().toLowerCase();
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(cleanEmail)) {
        next.delete(cleanEmail);
      } else {
        next.add(cleanEmail);
      }
      return next;
    });
  };

  // Select all or deselect all
  const handleSelectAll = () => {
    const allValid = contacts
      .filter(c => c.receive_sos !== false && c.email)
      .map(c => c.email.trim().toLowerCase());
    if (selectedEmails.size === allValid.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(allValid));
    }
  };

  // Trigger Send SOS Alert
  const handleSendSos = async () => {
    const emailList = Array.from(selectedEmails);
    if (emailList.length === 0) {
      setAlertFeedback({
        type: "warning",
        message: "Please select at least one contact to receive the SOS email."
      });
      return;
    }

    setSendingSos(true);
    setAlertFeedback(null);

    try {
      const result = await sendSosAlert(emailList, false);

      if (result.simulated) {
        setAlertFeedback({
          type: "warning",
          message: "Simulation mode: Server SMTP (SENDER_EMAIL / SENDER_PASSWORD) is not configured in backend/.env yet, so the email was simulated."
        });
      } else {
        setAlertFeedback({
          type: "success",
          message: `SOS alert email successfully sent to ${result.sent} contact(s)!`
        });
      }
      // Reload activities so newly logged action shows up
      await loadActivities();
    } catch (err) {
      setAlertFeedback({
        type: "error",
        message: err.message || "Failed to send SOS email. Please check your network or server configuration."
      });
    } finally {
      setSendingSos(false);
    }
  };

  const validSosContacts = contacts.filter(c => c.receive_sos !== false && c.email);

  return (
    <div className="p-6 sm:p-8 w-full flex flex-col min-h-screen bg-background relative overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600">
              <FontAwesomeIcon icon={faShieldHeart} className="text-2xl" />
            </div>
            <div>
              <h1 className="text-3xl font-heading font-bold text-textPrimary">Safe Place</h1>
              <p className="text-textSecondary text-sm">
                Your emergency circle & security dashboard.
              </p>
            </div>
          </div>

          {/* User badge */}
          {user && (
            <div className="flex items-center gap-2 bg-card border border-border px-4 py-2 rounded-xl text-sm self-start sm:self-auto">
              <FontAwesomeIcon icon={faUserCheck} className="text-primary text-xs" />
              <span className="text-textSecondary">Logged in as:</span>
              <span className="font-semibold text-textPrimary">{user.name || user.email}</span>
            </div>
          )}
        </div>

        {/* Sender Email Info Banner */}
        {!emailConfigured && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-amber-700 dark:text-amber-400">
            <FontAwesomeIcon icon={faCircleExclamation} className="mt-1" />
            <div className="text-sm leading-relaxed">
              <strong>Email server not yet connected:</strong> The server requires <code className="bg-amber-500/20 px-1.5 py-0.5 rounded font-mono text-xs">SENDER_EMAIL</code> and <code className="bg-amber-500/20 px-1.5 py-0.5 rounded font-mono text-xs">SENDER_PASSWORD</code> in <code className="bg-amber-500/20 px-1.5 py-0.5 rounded font-mono text-xs">backend/.env</code> (Gmail App Password) to dispatch live emails. Alerts will be simulated until configured.
            </div>
          </div>
        )}

        {/* Dispatch Action Panel */}
        <div className="bg-gradient-to-r from-red-500/10 via-rose-500/5 to-purple-500/10 border border-red-500/20 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                <h2 className="text-xl font-bold text-textPrimary">Emergency SOS Dispatch</h2>
              </div>
              <p className="text-sm text-textSecondary mt-1 max-w-xl">
                Send an immediate SOS email identifying you ({user?.name || "Logged-in user"}, {user?.email}) with safety helpline numbers directly to your selected contacts.
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full md:w-auto">
              <input
                type="text"
                placeholder="How are you feeling right now? (Optional: panic, scared, lonely...)"
                value={userSituationText}
                onChange={(e) => setUserSituationText(e.target.value)}
                className="w-full md:w-80 p-2.5 rounded-xl border border-red-200/60 bg-white/90 text-xs text-textPrimary placeholder:text-textSecondary/70 outline-none focus:border-red-500 shadow-2xs"
              />
              <button
                onClick={() => setSafetyModalOpen(true)}
                disabled={validSosContacts.length === 0}
                className="bg-red-600 hover:bg-red-700 active:scale-95 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl flex items-center justify-center gap-2.5 shadow-md shadow-red-500/20 transition-all cursor-pointer text-sm"
              >
                <FontAwesomeIcon icon={faPaperPlane} />
                Contact Safe Person / SOS
              </button>
            </div>
          </div>

          {/* Alert Feedback Banner */}
          {alertFeedback && (
            <div className={`mt-4 p-3.5 rounded-xl border flex items-center gap-3 text-sm ${
              alertFeedback.type === "success" 
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : alertFeedback.type === "warning"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"
            }`}>
              <FontAwesomeIcon icon={alertFeedback.type === "success" ? faCircleCheck : faCircleExclamation} />
              <span>{alertFeedback.message}</span>
            </div>
          )}
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Trusted Contacts Section */}
          <div className="bg-card border border-border p-6 rounded-2xl h-fit">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-textPrimary">Trusted Contacts</h2>
                <p className="text-xs text-textSecondary mt-0.5">Select who should receive the SOS email</p>
              </div>
              {validSosContacts.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-primary hover:underline font-medium cursor-pointer"
                >
                  {selectedEmails.size === validSosContacts.length ? "Deselect All" : "Select All"}
                </button>
              )}
            </div>
            
            <div className="space-y-3 mb-6">
              {contacts.map(contact => {
                const isSelected = contact.email && selectedEmails.has(contact.email.trim().toLowerCase());
                return (
                  <div 
                    key={contact.id} 
                    className={`p-4 border rounded-xl transition-all ${
                      isSelected ? "border-purple-500/50 bg-purple-500/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {/* Checkbox for choosing if this contact gets this SOS */}
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => contact.email && toggleContactSelection(contact.email)}
                          disabled={!contact.email || !contact.receive_sos}
                          className="mt-0.5 text-lg text-primary disabled:opacity-30 cursor-pointer"
                          title="Select to receive SOS email"
                        >
                          <FontAwesomeIcon icon={isSelected ? faCheckSquare : faSquare} />
                        </button>
                        <div>
                          <h3 className="font-semibold text-textPrimary text-sm">{contact.name}</h3>
                          {contact.email ? (
                            <p className="text-xs text-textSecondary flex items-center gap-1.5 mt-0.5">
                              <FontAwesomeIcon icon={faEnvelope} className="text-[10px]" />
                              {contact.email}
                            </p>
                          ) : (
                            <p className="text-xs text-amber-500">No email provided</p>
                          )}
                        </div>
                      </div>

                      {/* Right actions: Receive SOS toggle & delete */}
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-textSecondary cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={contact.receive_sos !== false}
                            onChange={() => toggleReceiveSos(contact.id)}
                            className="accent-primary"
                          />
                          SOS enabled
                        </label>
                        
                        <button 
                          onClick={() => handleDeleteContact(contact.id)} 
                          className="text-red-500 hover:text-red-700 transition p-1 text-sm cursor-pointer"
                          title="Delete contact"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {contacts.length === 0 && (
                <div className="text-textSecondary text-center py-8 border border-dashed border-border rounded-xl">
                  <p className="font-medium">No trusted contacts added yet.</p>
                  <p className="text-xs mt-1">Add friends, family, or counselors below to protect you.</p>
                </div>
              )}
            </div>
            
            {/* Add Contact Form */}
            <div className="border-t border-border pt-6 mt-6">
              <h3 className="font-medium text-sm text-textPrimary mb-3">Add New Contact</h3>
              <div className="flex flex-col gap-3">
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm"
                />
                <input 
                  type="email" 
                  placeholder="Email Address (e.g. friend@example.com)" 
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm"
                />
                <button 
                  onClick={handleAddContact}
                  disabled={!newContactName.trim() || !newContactEmail.trim()}
                  className="bg-primary hover:bg-primary/90 text-white p-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 mt-1 cursor-pointer font-medium text-sm transition shadow-sm"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Add to Trusted Circle
                </button>
              </div>
            </div>
          </div>
          
          {/* Safety Activity Log */}
          <div className="bg-card border border-border p-6 rounded-2xl h-fit max-h-[650px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-textPrimary">Safety Activity</h2>
                <p className="text-xs text-textSecondary mt-0.5">Audit log of emergency alerts and triggers</p>
              </div>
              <button 
                onClick={loadActivities}
                className="text-xs text-textSecondary hover:text-textPrimary"
              >
                Refresh
              </button>
            </div>
            
            <div className="space-y-3 overflow-y-auto pr-1">
              {activities.length > 0 ? activities.map((activity, index) => (
                <div key={activity.id || index} className="p-3.5 border border-border rounded-xl bg-background/50">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-medium text-sm text-textPrimary flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      {activity.title || (activity.type === "sos_manual" ? "Manual SOS Alert" : "Automatic Crisis SOS")}
                    </h3>
                    <span className="text-[11px] text-textSecondary">{activity.date || "Recently"}</span>
                  </div>
                  <p className="text-xs text-textSecondary leading-relaxed">{activity.description}</p>
                </div>
              )) : (
                <div className="text-textSecondary text-center py-8 border border-dashed border-border rounded-xl">
                  <p className="font-medium">No recent safety activity.</p>
                  <p className="text-xs mt-1">Alerts triggered here or via AI crisis support will log here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mindful Safety Verification & Grounding Modal */}
      <SafetyConsentModal
        isOpen={safetyModalOpen}
        onClose={() => setSafetyModalOpen(false)}
        contacts={contacts}
        contextText={userSituationText}
        isSuicideContext={false}
        onSosSuccess={async (res) => {
          setAlertFeedback({
            type: res.simulated ? "warning" : "success",
            message: res.message
          });
          await loadActivities();
        }}
      />
    </div>
  );
}

export default SafePlace;
