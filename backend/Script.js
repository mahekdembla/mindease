async function send() {
    let msg = document.getElementById("msg").value;

    if (msg.trim() === "") return;

    // USER MESSAGE
    document.getElementById("chatbox").innerHTML +=
        `<div class="user"><span>${msg}</span></div>`;

    try {
        let res = await fetch("http://127.0.0.1:8000/chat", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({message: msg})
        });

        let data = await res.json();

        // BOT RESPONSE
        document.getElementById("chatbox").innerHTML +=
            `<div class="bot"><span>${data.response}</span></div>`;

        // 🔥 EMOTION + MENTAL STATE DISPLAY
        let emotionElement = document.getElementById("emotion");

        if (emotionElement) {

            // Combine both
            let emotionText = data.emotion + " | " + data.mental_state;
            emotionElement.innerText = emotionText;

            // 🔥 COLOR LOGIC (BETTER)
            if (data.emotion === "positive") {
                emotionElement.style.color = "green";
            } 
            else if (data.emotion === "anxiety") {
                emotionElement.style.color = "orange";
            } 
            else if (data.emotion === "anger") {
                emotionElement.style.color = "red";
            } 
            else if (data.emotion === "negative") {
                emotionElement.style.color = "blue";
            } 
            else if (data.emotion === "crisis") {
                emotionElement.style.color = "darkred";
            } 
            else {
                emotionElement.style.color = "gray";
            }
        }

    } catch (error) {
        console.error(error);
    }

    document.getElementById("msg").value = "";

    // SCROLL DOWN
    let chatbox = document.getElementById("chatbox");
    chatbox.scrollTop = chatbox.scrollHeight;
}

// ENTER KEY SUPPORT
document.getElementById("msg").addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
        send();
    }
});



