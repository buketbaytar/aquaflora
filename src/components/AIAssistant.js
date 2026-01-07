export function AIAssistant() {
    return `
    <div class="ai-assistant">
      <div class="ai-chat-window glass-panel hidden" id="ai-chat">
        <div class="chat-header">
          <span>AI Asistan</span>
          <button class="close-chat">×</button>
        </div>
        <div class="chat-messages" id="chat-messages">
          <div class="message ai">
            Merhaba! Ben DeepDive AI. Size nasıl yardımcı olabilirim?
            <div class="suggestions">
              <button class="suggestion-btn" data-topic="suit">Hangi dalış kıyafeti?</button>
              <button class="suggestion-btn" data-topic="computer">Dalış bilgisayarı önerisi</button>
            </div>
          </div>
        </div>
        <div class="chat-input-area">
          <input type="text" placeholder="Bir soru sorun..." id="chat-input">
          <button id="send-btn">➤</button>
        </div>
      </div>
      
      <button class="ai-toggle-btn pulse-glow" id="ai-toggle">
        <span class="ai-icon">✨</span>
      </button>
    </div>
  `;
}

export function setupAIAssistant() {
    const toggleBtn = document.getElementById('ai-toggle');
    const chatWindow = document.getElementById('ai-chat');
    const closeBtn = document.querySelector('.close-chat');
    const sendBtn = document.getElementById('send-btn');
    const input = document.getElementById('chat-input');
    const messagesContainer = document.getElementById('chat-messages');

    const toggleChat = () => chatWindow.classList.toggle('hidden');

    toggleBtn.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);

    const addMessage = (text, type = 'user') => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${type} fade-in-up`;
        msgDiv.textContent = text;
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    const processAIResponse = (text) => {
        // Simulated AI Logic
        const loader = document.createElement('div');
        loader.className = 'message ai typing';
        loader.textContent = '...';
        messagesContainer.appendChild(loader);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        setTimeout(() => {
            loader.remove();
            let response = "Bunu anladığımdan emin değilim, ama uzman ekibimize yönlendirebilirim.";

            const lowerText = text.toLowerCase();
            if (lowerText.includes('fiyat')) response = "Ürünlerimiz premium segmentte olup, en iyi kalite/fiyat performansını sunar.";
            if (lowerText.includes('kargo')) response = "Tüm siparişlerde kargo ücretsizdir ve 24 saat içinde teslim edilir.";
            if (lowerText.includes('dalış kıyafeti') || lowerText.includes('elbise')) response = "Hangi sularda dalış yapacaksınız? Soğuk sular için 7mm, ılıman sular için 5mm öneririm.";

            addMessage(response, 'ai');
        }, 1500);
    };

    const sendMessage = () => {
        const text = input.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        input.value = '';
        processAIResponse(text);
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Handle Suggestions
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-btn')) {
            const topic = e.target.dataset.topic;
            let text = topic === 'suit' ? 'Hangi dalış kıyafeti bana uygun?' : 'Dalış bilgisayarı önerisi istiyorum.';
            addMessage(text, 'user');
            processAIResponse(text);
        }
    });
}
