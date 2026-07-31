class ChatbotApp {
    constructor() {
        this.messagesContainer = document.getElementById('chat-messages');
        this.quizMessagesContainer = document.getElementById('quiz-messages');
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.studentIdInput = document.getElementById('studentId');
        this.darkToggle = document.getElementById('dark-mode-toggle');

        this.btnUpcomingTests = document.getElementById('btn-upcoming-tests');
        this.btnUpcomingDue = document.getElementById('btn-upcoming-due');
        this.btnLowestGrade = document.getElementById('btn-lowest-grade');
        this.btnMissing = document.getElementById('btn-missing-assignments');

        this.chatPanel = document.getElementById('chat-panel');
        this.quizPanel = document.getElementById('quiz-panel');
        this.tabButtons = document.querySelectorAll('.tab-btn');
        this.quizOptionsContainer = document.getElementById('quiz-options');
        //this.backToChatButton = document.getElementById('back-to-chat-btn');

        this.apiBaseUrl = "https://parentpulse-production-f710.up.railway.app";
        this.isTyping = false;
        this.currentQuizId = null;
        this.activeTab = 'chat';
        this.currentMessageContainer = this.messagesContainer;
        this.quizResults = [];
        this.currentQuizQuestion = '';

        this.quizPdfOptions = [
            { label: 'Pre-Algebra', pdf: 'Pre-AlgStudyGuide.pdf' },
            { label: 'Life Science', pdf: 'LifeScienceStudyGuide.pdf' },
            { label: 'Social Studies', pdf: 'SocialStudiesStudyGuide.pdf' }
        ];

        // SUBJECT → PDF mapping
        this.pdfMap = {
            "Math": "Pre-AlgStudyGuide.pdf",
            "Pre-Algebra": "Pre-AlgStudyGuide.pdf",
            "Pre Algebra": "Pre-AlgStudyGuide.pdf",
            "Science": "LifeScienceStudyGuide.pdf",
            "Life Science": "LifeScienceStudyGuide.pdf",
            "Social Studies": "SocialStudiesStudyGuide.pdf",
            "History": "SocialStudiesStudyGuide.pdf",
            "US History": "SocialStudiesStudyGuide.pdf",
            "U.S. History": "SocialStudiesStudyGuide.pdf"
        };

        this.init();
    }

    init() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        const saved = localStorage.getItem('theme');
        if (saved === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            this.darkToggle.textContent = '☀️ Light';
        }
        this.darkToggle.addEventListener('click', () => this.toggleDarkMode());

        if (this.btnUpcomingTests) this.btnUpcomingTests.addEventListener('click', () => this.sendPreset('upcoming_tests'));
        if (this.btnUpcomingDue) this.btnUpcomingDue.addEventListener('click', () => this.sendPreset('upcoming_due'));
        if (this.btnLowestGrade) this.btnLowestGrade.addEventListener('click', () => this.sendPreset('lowest_grade'));
        if (this.btnMissing) this.btnMissing.addEventListener('click', () => this.sendPreset('missing_assignments'));

        this.tabButtons.forEach((btn) => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // if (this.backToChatButton) {
        //     this.backToChatButton.addEventListener('click', () => this.switchTab('chat'));
        // }

        this.renderQuizButtons();

        if ('ontouchstart' in window) {
            this.messageInput.focus();
        }

        this.handleViewportHeight();
        this.switchTab('chat');
    }

    switchTab(tab) {
        this.activeTab = tab;
        this.chatPanel.classList.toggle('is-active', tab === 'chat');
        this.quizPanel.classList.toggle('is-active', tab === 'quiz');
        this.currentMessageContainer = tab === 'quiz' ? this.quizMessagesContainer : this.messagesContainer;

        this.tabButtons.forEach((btn) => {
            const isActive = btn.dataset.tab === tab;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        this.messageInput.placeholder = tab === 'quiz' ? 'Type your quiz answer...' : 'Type your message...';
        this.messageInput.focus();
    }

    renderQuizButtons() {
        if (!this.quizOptionsContainer) return;

        this.quizOptionsContainer.innerHTML = '';

        this.quizPdfOptions.forEach((option) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'quiz-pdf-btn';
            button.textContent = option.label;
            button.addEventListener('click', () => this.startQuizFromPDF(option.pdf));
            this.quizOptionsContainer.appendChild(button);
        });
    }

    toggleDarkMode() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
        this.darkToggle.textContent = isDark ? '🌙 Dark' : '☀️ Light';
        localStorage.setItem('theme', isDark ? '' : 'dark');
    }

    handleViewportHeight() {
        const setVH = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
        setVH();
        window.addEventListener('resize', setVH);
        window.addEventListener('orientationchange', setVH);
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        const studentId = this.studentIdInput.value.trim();

        if (!message) return;

        if (this.activeTab === 'quiz') {
            if (!this.currentQuizId) {
                this.showError('Select a study guide to start a quiz.');
                return;
            }

            const currentQuestion = this.currentQuizQuestion;
            this.addMessage(message, 'user');
            this.messageInput.value = '';
            this.setInputDisabled(true);
            this.showTypingIndicator();

            try {
                const response = await fetch(`${this.apiBaseUrl}/api/chat/quiz-answer`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        quizId: this.currentQuizId,
                        answer: message
                    })
                });

                const data = await response.json();
                this.hideTypingIndicator();

                this.quizResults.push({
                    question: currentQuestion,
                    answer: message,
                    correct: Boolean(data.correct),
                    explanation: data.explanation || 'No explanation provided.'
                });

                this.addMessage(
                    `${data.correct ? '✅ Correct' : '❌ Incorrect'}<br>${data.explanation}`,
                    'bot'
                );

                if (data.nextQuestion !== null && data.nextQuestion !== undefined) {
                    this.currentQuizQuestion = data.nextQuestion;
                    this.addMessage(data.nextQuestion, 'bot');
                } else {
                    this.addMessage('🎉 Quiz complete!', 'bot');
                    this.showQuizSummary();
                    this.currentQuizId = null;
                    this.currentQuizQuestion = '';
                    this.quizResults = [];
                }
            } catch (err) {
                this.hideTypingIndicator();
                this.showError('Quiz error — try again.');
                console.error(err);
            }

            this.setInputDisabled(false);
            this.messageInput.focus();
            return;
        }

        if (!studentId || isNaN(parseInt(studentId))) {
            this.showError('Please enter a valid Student ID');
            return;
        }

        this.addMessage(message, 'user');
        this.messageInput.value = '';
        this.setInputDisabled(true);
        this.showTypingIndicator();

        try {
            const response = await this.callChatAPI(message, studentId);
            this.hideTypingIndicator();
            this.addMessage(response, 'bot');
        } catch (error) {
            this.hideTypingIndicator();
            this.showError('Sorry, I encountered an error. Please try again.');
            console.error('Chat API error:', error);
        }

        this.setInputDisabled(false);
        this.messageInput.focus();
    }

    async callChatAPI(question, studentId, report = null) {
        const body = {
            question: question,
            studentUserId: parseInt(studentId),
            courseId: null
        };
        if (report) body.report = report;

        const response = await fetch(`${this.apiBaseUrl}/api/chat/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        return data.response || data.answer || data.message || data.error || 'I received your message but couldn\'t generate a response.';
    }

    addMessage(content, sender, options = {}) {
        const container = options.container || this.currentMessageContainer;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        if (sender === 'bot') {
            contentDiv.innerHTML = content;
        } else {
            contentDiv.textContent = content;
        }

        messageDiv.appendChild(contentDiv);

        if (sender === 'bot' && options.showMoreDetails) {
            const detailsBtn = document.createElement('button');
            detailsBtn.className = 'more-details-btn';
            detailsBtn.textContent = 'More Details';

            detailsBtn.addEventListener('click', async () => {
                detailsBtn.disabled = true;
                try {
                    await this.loadMoreDetails(messageDiv, options.subjects);
                } catch (err) {
                    detailsBtn.disabled = false;
                    throw err;
                }
            });

            messageDiv.appendChild(detailsBtn);
        }

        container.appendChild(messageDiv);
        this.scrollToBottom(container);
    }

    showTypingIndicator() {
        if (this.isTyping) return;
        this.isTyping = true;

        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot-message typing-indicator';
        typingDiv.id = 'typing-indicator';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        const dots = document.createElement('div');
        dots.innerHTML = '<span></span><span></span><span></span>';
        contentDiv.appendChild(dots);

        typingDiv.appendChild(contentDiv);
        this.currentMessageContainer.appendChild(typingDiv);
        this.scrollToBottom(this.currentMessageContainer);
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) typingIndicator.remove();
        this.isTyping = false;
    }

    showError(message) {
        this.addMessage(message, 'bot');
        const lastMessage = this.currentMessageContainer.lastElementChild;
        if (lastMessage && lastMessage.classList.contains('bot-message')) {
            lastMessage.classList.add('error-message');
        }
    }

    setInputDisabled(disabled) {
        this.messageInput.disabled = disabled;
        this.sendButton.disabled = disabled;
        this.sendButton.textContent = disabled ? 'Sending...' : 'Send';
    }

    scrollToBottom(container = this.currentMessageContainer) {
        setTimeout(() => {
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 100);
    }

    detectSubjects(text) {
        const subjects = Object.keys(this.pdfMap);
        const found = [];

        for (const s of subjects) {
            if (text.toLowerCase().includes(s.toLowerCase())) {
                found.push(s);
            }
        }

        return [...new Set(found)];
    }

    async sendPreset(kind) {
        const studentId = this.studentIdInput.value.trim();
        if (!studentId || isNaN(parseInt(studentId))) {
            this.showError('Please enter a valid Student ID');
            return;
        }

        const prompts = {
            upcoming_tests: 'Please provide the upcoming tests and exam schedule for this student this week.',
            upcoming_due: 'List upcoming due dates and homework due soon for this student.',
            lowest_grade: "Which class does this student have the lowest overall grade in? Only tell me the class with the lowest overall grade and corresponding details as to why that grade is low.",
            missing_assignments: 'List missing assignments for this student.'
        };

        const question = prompts[kind] || 'Please summarize the student status.';

        let report = null;
        try {
            const r = await fetch('/sampleReport.json');
            if (r.ok) report = await r.json();
        } catch (e) {
            console.warn('Could not fetch sampleReport.json', e);
        }

        this.addMessage(question, 'user');
        this.setInputDisabled(true);
        this.showTypingIndicator();

        try {
            const response = await this.callChatAPI(question, studentId, report);
            this.hideTypingIndicator();

            const subjects = this.detectSubjects(response);

            const options = {};
            if (kind === 'upcoming_tests' && subjects.length > 0) {
                options.showMoreDetails = true;
                options.subjects = subjects;
            }

            this.addMessage(response, 'bot', options);
        } catch (err) {
            this.hideTypingIndicator();
            this.showError('Sorry, I encountered an error. Please try again.');
            console.error('Preset API error:', err);
        }

        this.setInputDisabled(false);
    }

    async loadMoreDetails(parentMessage, subjects) {
        try {
            const pdfUrls = subjects
                .map(s => this.pdfMap[s])
                .filter(Boolean);

            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'more-details-content';

            if (pdfUrls.length === 0) {
                detailsDiv.innerHTML = '<p>No relevant PDFs available for these subjects.</p>';
                parentMessage.appendChild(detailsDiv);
                return;
            }

            let html = `
                <div style="margin-top:10px;">
                    <strong style="color:white;">Additional Details</strong>
                    <p style="color:white;">Use the Quiz tab to practice with the available study guides.</p>
            `;

            pdfUrls.forEach((pdfUrl, idx) => {
                html += `
                    <div style="margin-top:25px; padding:15px; border-radius:8px; background:#333;">
                        <p style="color:white;"><strong>Study Guide ${idx + 1}</strong></p>
                        <div class="pdf-attachment" style="margin-bottom:10px;">
                            📄 <a href="${pdfUrl}" target="_blank" download style="color:white; text-decoration:underline;">
                                Download PDF
                            </a>
                        </div>

                        <button class="quiz-me-btn" style="
                            margin-top:8px;
                            padding:10px 16px;
                            border-radius:6px;
                            background:#ffffff;
                            color:#000;
                            border:none;
                            cursor:pointer;
                        " data-pdf="${pdfUrl}">
                            Open Quiz Tab
                        </button>
                    </div>
                `;
            });

            html += '</div>';
            detailsDiv.innerHTML = html;

            parentMessage.appendChild(detailsDiv);

            const btn = parentMessage.querySelector('.more-details-btn');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Details Loaded';
            }

            detailsDiv.querySelectorAll('.quiz-me-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const pdfName = btn.getAttribute('data-pdf');
                    this.switchTab('quiz');
                    this.startQuizFromPDF(pdfName);
                });
            });
        } catch (error) {
            console.error(error);
            this.showError('Unable to load additional details.');
        }
    }

    async startQuizFromPDF(pdfName) {
        this.switchTab('quiz');
        this.quizMessagesContainer.innerHTML = '';
        this.quizResults = [];
        this.currentQuizQuestion = '';
        this.addMessage('Starting quiz based on the PDF…', 'bot');
        this.showTypingIndicator();

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/chat/quiz-from-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pdfName })
            });

            const data = await response.json();
            this.hideTypingIndicator();

            const quizId = data.quizId;
            const firstQuestion = data.question;

            if (quizId && firstQuestion) {
                this.currentQuizId = quizId;
                this.currentQuizQuestion = firstQuestion;
                this.addMessage(firstQuestion, 'bot');
            } else {
                this.addMessage('Unable to start quiz.', 'bot');
            }
        } catch (err) {
            this.hideTypingIndicator();
            this.showError('Unable to start quiz.');
            console.error(err);
        }
    }

    getImprovementAreas(results) {
        const incorrect = results.filter((entry) => !entry.correct);

        if (incorrect.length === 0) {
            return ['Great job — no improvement areas detected.'];
        }

        return incorrect.map((entry) => {
            const cleaned = (entry.question || '')
                .replace(/^[^a-z0-9]+/i, '')
                .split(/[?!.:;]/)[0]
                .trim();

            return cleaned.length > 0 ? cleaned : 'Review the quiz concepts again.';
        }).slice(0, 3);
    }

    showQuizSummary() {
        const results = this.quizResults;
        if (!results || results.length === 0) return;

        const totalQuestions = results.length;
        const correct = results.filter((result) => result.correct).length;
        const incorrect = totalQuestions - correct;
        const percentage = Math.round((correct / totalQuestions) * 100);
        const improvementAreas = this.getImprovementAreas(results);

        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'quiz-summary';

        summaryDiv.innerHTML = `
            <div style="margin-top:20px; padding:15px; border-radius:8px; background:#222; color:white;">
                <h3>📊 Quiz Summary</h3>
                <p><strong>Score:</strong> ${correct}/${totalQuestions} (${percentage}%)</p>
                <p><strong>Correct:</strong> ${correct}</p>
                <p><strong>Incorrect:</strong> ${incorrect}</p>
                <p><strong>Needs improvement:</strong> ${incorrect > 0 ? 'Yes' : 'No'}</p>

                <h4 style="margin-top:15px;">Where to improve</h4>
                <ul style="padding-left:20px; margin-top:8px;">
                    ${improvementAreas.map((area) => `<li style="margin-bottom:8px;">${area}</li>`).join('')}
                </ul>

                <h4 style="margin-top:15px;">Your Answers</h4>
                <ul style="padding-left:20px;">
                    ${results.map((result) => `
                        <li style="margin-bottom:12px;">
                            <strong>Q:</strong> ${result.question}<br>
                            <strong>A:</strong> ${result.answer}<br>
                            <strong>Result:</strong> ${result.correct ? '✅ Correct' : '❌ Incorrect'}<br>
                            <em>${result.explanation}</em>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;

        this.quizMessagesContainer.appendChild(summaryDiv);
        this.scrollToBottom(this.quizMessagesContainer);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatbotApp();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // navigator.serviceWorker.register('/sw.js');
    });
}
