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
import { API_URL, sendSosAlert, sendSmsSosAlert, getSafetyActivities, getSafetyStatus } from "../../services/api";
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
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactReceiveSms, setNewContactReceiveSms] = useState(false);

  // Selection state for sending SOS alerts to chosen contacts
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  
  // Status states
  const [sendingSos, setSendingSos] = useState(false);
  const [alertFeedback, setAlertFeedback] = useState(null); // { type: 'success' | 'warning' | 'error', message: '' }
  const [emailConfigured, setEmailConfigured] = useState(true);
  const [smsConfigured, setSmsConfigured] = useState(false);
  const [smsMode, setSmsMode] = useState("demo");
  const [sendingSms, setSendingSms] = useState(false);
  const [smsFeedback, setSmsFeedback] = useState(null);

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
      setSmsConfigured(status.sms_configured === true);
      setSmsMode(status.sms_mode || "demo");
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
    const name = newContactName.trim();
    const email = newContactEmail.trim();
    const phone = newContactPhone.trim();

    if (!name || (!email && !phone)) return;

    const contactData = {
      name,
      email,
      phone,
      relationship: "",
      receive_sos: Boolean(email),
      receive_sms: Boolean(phone && newContactReceiveSms)
    };

    try {
      const res = await fetch(`${API_URL}/api/contacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("mindease_token") || ""}`
        },
        credentials: "include",
        body: JSON.stringify(contactData)
      });

      if (res.ok) {
        const created = await res.json();
        const updated = [...contacts, created];

        setContacts(updated);
        localStorage.setItem("trustedContacts", JSON.stringify(updated));

        if (created.email) {
          setSelectedEmails(prev =>
            new Set([...prev, created.email.trim().toLowerCase()])
          );
        }

        setNewContactName("");
        setNewContactEmail("");
        setNewContactPhone("");
        setNewContactReceiveSms(false);
        return;
      }

      const errorText = await res.text();
      console.error("Could not save trusted contact:", res.status, errorText);
      setAlertFeedback({
        type: "error",
        message: "Could not save contact to the server. Please check your login and backend connection."
      });
      return;
    } catch (e) {
      console.error("Failed to save contact to API:", e);
      setAlertFeedback({
        type: "error",
        message: "Could not connect to the server. Your contact was not saved."
      });
    }
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

 
const toggleReceiveSms = async (id) => {
  const target = contacts.find((contact) => contact.id === id);
  if (!target) return;

  if (!target.phone?.trim()) {
    setSmsFeedback({
      type: "warning",
      message: "Add a phone number before enabling SMS alerts."
    });
    return;
  }

  const previousValue = target.receive_sms === true;
  const nextValue = !previousValue;

  setSmsFeedback(null);

  // Update the UI immediately.
  setContacts((current) =>
    current.map((contact) =>
      contact.id === id
        ? { ...contact, receive_sms: nextValue }
        : contact
    )
  );

  try {
    const response = await fetch(`${API_URL}/api/contacts/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("mindease_token") || ""}`
      },
      credentials: "include",
      body: JSON.stringify({ receive_sms: nextValue })
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const saved = await response.json();

    setContacts((current) =>
      current.map((contact) =>
        contact.id === id
          ? { ...contact, ...saved }
          : contact
      )
    );

    setContacts((current) => {
      localStorage.setItem("trustedContacts", JSON.stringify(current));
      return current;
    });
  } catch (error) {
    // Roll back only the contact whose update failed.
    setContacts((current) => {
      const rolledBack = current.map((contact) =>
        contact.id === id
          ? { ...contact, receive_sms: previousValue }
          : contact
      );

      localStorage.setItem("trustedContacts", JSON.stringify(rolledBack));
      return rolledBack;
    });

    setSmsFeedback({
      type: "error",
      message: error.message || "Could not update SMS consent. Please try again."
    });
  }
};

  const handleSendSmsSos = async () => {
    const eligible = contacts.filter((contact) => contact.receive_sms === true && contact.phone?.trim() && contact.id);
    if (!eligible.length) {
      setSmsFeedback({ type: "warning", message: "Add a phone number and explicitly enable SMS alerts for at least one trusted contact." });
      return;
    }
    if (smsMode === "msg91" && !smsConfigured) {
      setSmsFeedback({ type: "error", message: "MSG91 mode is selected, but the backend is missing its authentication key or template ID. No SMS was sent." });
      return;
    }
    const isDemo = smsMode !== "msg91";
    const prompt = isDemo
      ? `Run a DEMO for ${eligible.length} SMS-enabled contact(s)? No real SMS will be sent.`
      : `Send an SMS SOS request to ${eligible.length} SMS-enabled trusted contact(s)? The message will ask them to contact you. This action cannot be undone.`;
    if (!window.confirm(prompt)) return;

    setSendingSms(true);
    setSmsFeedback(null);
    try {
      const result = await sendSmsSosAlert(eligible.map((contact) => contact.id));
      if (result.simulated) {
        setSmsFeedback({ type: "warning", message: "SMS simulated — no message was sent. Configure MSG91 to enable real SMS." });
      } else {
        setSmsFeedback({ type: "success", message: `The SMS provider accepted the request for ${result.submitted} contact(s). Delivery is not confirmed.` });
      }
      await loadActivities();
    } catch (error) {
      setSmsFeedback({ type: "error", message: error.message || "Could not request SMS alert." });
    } finally {
      setSendingSms(false);
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
              <button
                type="button"
                onClick={handleSendSmsSos}
                disabled={sendingSms || !contacts.some((contact) => contact.receive_sms === true && contact.phone?.trim() && contact.id)}
                className="bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl flex items-center justify-center gap-2.5 shadow-sm transition-all cursor-pointer text-sm"
              >
                <FontAwesomeIcon icon={sendingSms ? faSpinner : faPaperPlane} spin={sendingSms} />
                {sendingSms ? "Processing SMS alert..." : "Send SMS Safe Space Alert"}
              </button>
              <p className="text-[11px] text-textSecondary max-w-sm">
                {smsMode === "msg91" && smsConfigured
                  ? "MSG91 is configured. Provider acceptance does not guarantee delivery."
                  : "Demo mode is active: no SMS will be sent until MSG91 is configured."}
              </p>
            </div>
          </div>

          {smsFeedback && (
            <div className={`mt-4 p-3.5 rounded-xl border flex items-center gap-3 text-sm ${
              smsFeedback.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : smsFeedback.type === "warning"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"
            }`}>
              <FontAwesomeIcon icon={smsFeedback.type === "success" ? faCircleCheck : faCircleExclamation} />
              <span>{smsFeedback.message}</span>
            </div>
          )}

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
                <p className="text-xs text-textSecondary mt-0.5">Manage email alerts and explicit SMS consent for each trusted contact</p>
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
                            <p className="text-xs text-textSecondary">No email provided</p>
                          )}
                          {contact.phone && <p className="text-xs text-textSecondary mt-1">Phone: {contact.phone}</p>}
                        </div>
                      </div>

                      {/* Right actions: Receive SOS toggle & delete */}
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-2 items-start">
                          <label className="flex items-center gap-1.5 text-xs text-textSecondary cursor-pointer">
                            <input
                              type="checkbox"
                              checked={contact.receive_sos !== false}
                              onChange={() => toggleReceiveSos(contact.id)}
                              className="accent-primary"
                            />
                            Email SOS
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-textSecondary cursor-pointer" title="Enable only if this person has agreed to receive SMS alerts">
                            <input
                              type="checkbox"
                              checked={contact.receive_sms === true}
                              onChange={() => toggleReceiveSms(contact.id)}
                              disabled={!contact.phone?.trim()}
                              className="accent-primary"
                            />
                            SMS consent
                          </label>
                        </div>
                        
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
                  placeholder="Email Address (optional)"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm"
                />
                <input
                  type="tel"
                  placeholder="Phone number with country code (e.g. +91XXXXXXXXXX)"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  autoComplete="tel"
                  className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm"
                />
                <label className="flex items-start gap-2 text-xs text-textSecondary leading-relaxed">
                  <input
                    type="checkbox"
                    checked={newContactReceiveSms}
                    onChange={(e) => setNewContactReceiveSms(e.target.checked)}
                    disabled={!newContactPhone.trim()}
                    className="accent-primary mt-0.5"
                  />
                  <span>This trusted person has agreed to receive SMS safety alerts. Keep this unchecked unless they have consented.</span>
                </label>
                <button
                  onClick={handleAddContact}
                  disabled={!newContactName.trim() || (!newContactEmail.trim() && !newContactPhone.trim()) || (newContactReceiveSms && !newContactPhone.trim())}
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
