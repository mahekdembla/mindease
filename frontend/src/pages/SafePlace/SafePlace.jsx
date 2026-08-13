import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faShieldHeart } from "@fortawesome/free-solid-svg-icons";

function SafePlace() {
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  
  useEffect(() => {
    const savedContacts = JSON.parse(localStorage.getItem("trustedContacts")) || [];
    setContacts(savedContacts);
    
    const savedActivities = JSON.parse(localStorage.getItem("safetyActivities")) || [];
    // Sort latest first
    setActivities(savedActivities.sort((a, b) => b.timestamp - a.timestamp));
  }, []);
  
  const handleAddContact = () => {
    if (!newContactName.trim()) return;
    
    const newContact = {
      id: Date.now(),
      name: newContactName,
      email: newContactEmail,
      receive_sos: true
    };
    
    const updated = [...contacts, newContact];
    setContacts(updated);
    localStorage.setItem("trustedContacts", JSON.stringify(updated));
    
    setNewContactName("");
    setNewContactEmail("");
  };
  
  const handleDeleteContact = (id) => {
    const updated = contacts.filter(c => c.id !== id);
    setContacts(updated);
    localStorage.setItem("trustedContacts", JSON.stringify(updated));
  };
  
  const toggleReceiveSos = (id) => {
    const updated = contacts.map(c => {
      if (c.id === id) {
        return { ...c, receive_sos: !c.receive_sos };
      }
      return c;
    });
    setContacts(updated);
    localStorage.setItem("trustedContacts", JSON.stringify(updated));
  };
  
  return (
    <div className="p-8 w-full flex flex-col h-screen overflow-y-auto">
      <div className="flex items-center gap-3 mb-8">
        <FontAwesomeIcon icon={faShieldHeart} className="text-3xl text-primary" />
        <div>
          <h1 className="text-3xl font-heading font-semibold text-textPrimary">Safe Place</h1>
          <p className="text-textSecondary">Manage your trusted contacts and safety settings.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Trusted Contacts Section */}
        <div className="bg-card border border-border p-6 rounded-2xl h-fit">
          <h2 className="text-xl font-semibold mb-4">Trusted Contacts</h2>
          
          <div className="space-y-4 mb-6">
            {contacts.map(contact => (
              <div key={contact.id} className="flex items-center justify-between p-4 border border-border rounded-xl">
                <div>
                  <h3 className="font-semibold">{contact.name}</h3>
                  {contact.email && <p className="text-sm text-textSecondary">{contact.email}</p>}
                </div>
                
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={contact.receive_sos}
                      onChange={() => toggleReceiveSos(contact.id)}
                      className="accent-primary"
                    />
                    Receive SOS
                  </label>
                  
                  <button onClick={() => handleDeleteContact(contact.id)} className="text-red-500 hover:text-red-700 transition p-2">
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            ))}
            
            {contacts.length === 0 && (
              <p className="text-textSecondary text-center py-4">No trusted contacts added yet.</p>
            )}
          </div>
          
          <div className="border-t border-border pt-6 mt-6">
            <h3 className="font-medium mb-3">Add New Contact</h3>
            <div className="flex flex-col gap-3">
              <input 
                type="text" 
                placeholder="Name" 
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                className="w-full p-3 rounded-xl border border-border outline-none focus:border-primary"
              />
              <input 
                type="email" 
                placeholder="Email Address (Required)" 
                value={newContactEmail}
                onChange={(e) => setNewContactEmail(e.target.value)}
                className="w-full p-3 rounded-xl border border-border outline-none focus:border-primary"
              />
              <button 
                onClick={handleAddContact}
                disabled={!newContactName.trim() || !newContactEmail.trim()}
                className="bg-primary text-white p-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                <FontAwesomeIcon icon={faPlus} />
                Add Contact
              </button>
            </div>
          </div>
        </div>
        
        {/* Safety Activity Log */}
        <div className="bg-card border border-border p-6 rounded-2xl h-fit max-h-[600px] overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4">Safety Activity</h2>
          
          <div className="space-y-4">
            {activities.length > 0 ? activities.map((activity, index) => (
              <div key={index} className="p-4 border border-border rounded-xl">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-medium">{activity.title}</h3>
                  <span className="text-xs text-textSecondary">{activity.date}</span>
                </div>
                <p className="text-sm text-textSecondary">{activity.description}</p>
              </div>
            )) : (
              <p className="text-textSecondary text-center py-4">No recent safety activity.</p>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}

export default SafePlace;
