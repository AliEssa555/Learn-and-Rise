let mediaRecorder;
let audioChunks = [];

document.getElementById('text-mode').addEventListener('click', () => {
    toggleInputMode('text');
});

document.getElementById('voice-mode').addEventListener('click', () => {
    toggleInputMode('voice');
});

document.getElementById('send-text').addEventListener('click', sendMessage);
document.getElementById('user-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

document.getElementById('start-recording').addEventListener('click', toggleRecording);

function toggleInputMode(mode) {
    if (mode === 'text') {
        document.getElementById('text-input-container').style.display = 'flex';
        document.getElementById('voice-input-container').style.display = 'none';
        document.getElementById('text-mode').classList.add('active');
        document.getElementById('voice-mode').classList.remove('active');
    } else {
        document.getElementById('text-input-container').style.display = 'none';
        document.getElementById('voice-input-container').style.display = 'block';
        document.getElementById('text-mode').classList.remove('active');
        document.getElementById('voice-mode').classList.add('active');
    }
}

async function toggleRecording() {
    const button = document.getElementById('start-recording');
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        button.innerHTML = '<i class="fas fa-microphone"></i> Record';
    } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = sendAudio;
        
        mediaRecorder.start();
        button.innerHTML = '<i class="fas fa-stop"></i> Stop';
    }
}

async function sendAudio() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', audioBlob);
    formData.append('input_type', 'audio');
    
    processInput(formData);
}

async function sendMessage() {
    const input = document.getElementById('user-input');
    const formData = new FormData();
    formData.append('message', input.value);
    formData.append('input_type', 'text');
    
    processInput(formData);
    input.value = '';
}

async function processInput(formData) {
    const chatHistory = document.getElementById('chat-history');
    const response = await fetch('/process_input', {
        method: 'POST',
        body: formData
    });
    
    const data = await response.json();
    
    if (data.error) {
        alert(data.error);
        return;
    }
    
    // Add user message
    addMessage(data.user_input, 'user', data.input_type);
    
    // Add bot response
    addMessage(data.bot_response, 'bot');
}

function addMessage(content, sender, inputType = null) {
    const chatHistory = document.getElementById('chat-history');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    if (sender === 'user') {
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="sender">You</span>
                <span class="message-type">
                    ${inputType === 'audio' ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-keyboard"></i>'}
                </span>
            </div>
            <div class="message-content">${content}</div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="sender">Tutor</span>
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">${content}</div>
        `;
    }
    
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}