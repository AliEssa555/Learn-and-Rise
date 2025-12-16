function loadVideo() {
    const url = document.getElementById('url').value.trim();
    if (!url) return;
    
    const playerDiv = document.getElementById('player');
    const subtitlesDiv = document.getElementById('subtitles');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // Show loading state
    subtitlesDiv.innerHTML = '';
    loadingSpinner.style.display = 'block';
    
    // Load video
    const videoId = getVideoId(url);
    if (videoId) {
        playerDiv.innerHTML = `
            <iframe src="https://www.youtube.com/embed/${videoId}?enablejsapi=1" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen></iframe>
        `;
        
        // Fetch subtitles
        fetch('/subtitles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        })
        .then(res => res.json())
        .then(data => {
            loadingSpinner.style.display = 'none';
            displaySubtitles(data);
        })
        .catch(error => {
            loadingSpinner.style.display = 'none';
            subtitlesDiv.innerHTML = `
                <div class="alert alert-danger">
                    Error loading subtitles: ${error.message}
                </div>
            `;
        });
    }
}

function getVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function displaySubtitles(subs) {
    const container = document.getElementById('subtitles');
    container.innerHTML = '';
    
    subs.forEach(item => {
        const sentence = item.text;
        const words = sentence.split(/\s+/);
        
        const sentenceDiv = document.createElement('div');
        sentenceDiv.className = 'transcript-line';
        
        words.forEach(word => {
            const span = document.createElement('span');
            span.className = 'transcript-word';
            span.innerText = word + ' ';
            span.onclick = () => sendToChatbot(
                word.replace(/[^\w']/g, ''), // Clean word
                sentence
            );
            sentenceDiv.appendChild(span);
        });
        
        container.appendChild(sentenceDiv);
    });
}

function sendToChatbot(word, sentence) {
    const responseDiv = document.getElementById('chatbot-response');
    const wordHeader = document.getElementById('word-header');
    const currentWordSpan = document.getElementById('current-word');
    
    // Show loading state
    responseDiv.innerHTML = `
        <div class="text-center">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Analyzing "${word}"...</p>
        </div>
    `;
    
    // Show word header
    currentWordSpan.textContent = word;
    wordHeader.style.display = 'flex';
    
    // Scroll to response
    responseDiv.scrollIntoView({ behavior: 'smooth' });
    
    // Fetch explanation
    fetch('/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: word, sentence: sentence })
    })
    .then(res => res.json())
    .then(data => {
        formatResponse(data.response);
    })
    .catch(error => {
        responseDiv.innerHTML = `
            <div class="alert alert-danger">
                Error getting explanation: ${error.message}
            </div>
        `;
    });
}

function formatResponse(responseText) {
    const responseDiv = document.getElementById('chatbot-response');
    
    // Define all section headers and subheaders
    const sections = {
        '✨': 'Word Focus',
        '📚': 'Core Meanings',
        '🔍': 'In This Sentence',
        '🎯': 'Learning Tips',
        '💬': 'Usage Examples',
        '🌍': 'Cultural Note',
        '📝': 'Practice Exercise',
        '🔔': "Teacher's Note"
    };

    // Define subheaders to highlight
    const subHeaders = [
        'Pronunciation:', 
        'Part of Speech:',
        'Primary Definition:',
        'Secondary Definition:',
        'Memory Trick:',
        'Common Mistakes:',
        'Related Words:',
        'Formal:',
        'Casual:',
        'Academic:',
        'Regional variations:'
    ];

    let html = '';
    const lines = responseText.split('\n').filter(l => l.trim());

    lines.forEach(line => {
        // Check for main section headers
        const sectionIcon = Object.keys(sections).find(icon => line.startsWith(icon));
        if (sectionIcon) {
            html += `</div><div class="response-section">
                     <div class="section-header">
                       <span class="section-icon">${sectionIcon}</span>
                       <h3>${sections[sectionIcon]}</h3>
                     </div>`;
            return;
        }

        // Check for subheaders to highlight
        const subHeader = subHeaders.find(sh => line.includes(sh));
        if (subHeader) {
            const parts = line.split(subHeader);
            html += `<div class="sub-header">
                       <strong>${subHeader}</strong>
                       <span>${parts[1]}</span>
                     </div>`;
            return;
        }

        // Regular content
        if (line.trim() && !line.includes('===')) {
            html += `<p>${line}</p>`;
        }
    });

    // Add interactive elements
    html = html.replace(/<\/div>/, '<div class="interactive-elements">') + '</div>';

    responseDiv.innerHTML = html || `<div class="error">Unable to format response</div>`;

    // Add click handlers for interactive elements
    document.querySelectorAll('.sub-header').forEach(header => {
        header.addEventListener('click', function() {
            this.classList.toggle('expanded');
            const content = this.nextElementSibling;
            if (content && content.classList) {
                content.classList.toggle('show');
            }
        });
    });
}

function closeWordView() {
    document.getElementById('word-header').style.display = 'none';
    document.getElementById('chatbot-response').innerHTML = `
        <div class="text-center text-muted">
            <i class="fas fa-hand-pointer fa-2x mb-2"></i>
            <p>Click on any word in the transcript to see its explanation</p>
        </div>
    `;
}