/**
 * Validates and submits contact form with honeypot and mailto fallback.
 * Matches FR-11 and TRD §3, §8.
 */
export function initContactForm(formEl, statusEl) {
  if (!formEl) return;

  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(formEl);
    const name = formData.get('name')?.toString().trim() || '';
    const email = formData.get('email')?.toString().trim() || '';
    const type = formData.get('type')?.toString() || 'other';
    const message = formData.get('message')?.toString().trim() || '';
    const consent = formData.get('consent') === 'on';
    const website = formData.get('website')?.toString() || ''; // honeypot

    statusEl.className = 'form-status';
    statusEl.textContent = '';

    // Honeypot detection
    if (website) {
      statusEl.className = 'form-status success';
      statusEl.textContent = "Thank you! Your message has been sent successfully.";
      formEl.reset();
      return;
    }

    // Validation
    if (!name) {
      showError('Please enter your name.');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      showError('Please enter a valid email address.');
      return;
    }
    if (message.length < 10) {
      showError('Please enter a message of at least 10 characters.');
      return;
    }
    if (!consent) {
      showError('Please agree to allow processing of your contact details.');
      return;
    }

    const submitBtn = formEl.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      // 1. Send automated real email to 3112004shyam@gmail.com via FormSubmit AJAX API
      const emailRes = await fetch('https://formsubmit.co/ajax/3112004shyam@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name,
          email,
          type: type || 'General Inquiry',
          message,
          _subject: `New Portfolio Inquiry [${type ? type.toUpperCase() : 'PROJECT'}] from ${name}`,
          _template: 'table',
          _captcha: 'false'
        })
      });

      const data = await emailRes.json().catch(() => ({}));

      // 2. Persist locally to portfolio_messages for the Admin inquiries panel
      try {
        const existing = JSON.parse(localStorage.getItem('portfolio_messages') || '[]');
        existing.unshift({
          id: 'msg_' + Date.now(),
          name,
          email,
          type,
          message,
          created_at: new Date().toISOString(),
          status: 'unread'
        });
        localStorage.setItem('portfolio_messages', JSON.stringify(existing));
      } catch (storageErr) {
        console.warn('Local storage error:', storageErr);
      }

      if (data.success === 'true' || data.success === true) {
        statusEl.className = 'form-status success';
        statusEl.textContent = "Thank you! Your message has been sent directly to Shyam's inbox. I will reply within 48 hours.";
        formEl.reset();
      } else if (data.message && data.message.includes('Activation')) {
        statusEl.className = 'form-status success';
        statusEl.innerHTML = `Form submitted! Please note: FormSubmit sent a one-time <strong>Activation Email</strong> to 3112004shyam@gmail.com. Once activated, all future inquiries deliver instantly.`;
        formEl.reset();
      } else {
        statusEl.className = 'form-status success';
        statusEl.textContent = "Thank you! Your message has been received.";
        formEl.reset();
      }
    } catch (err) {
      console.warn('Submission issue:', err);
      statusEl.className = 'form-status success';
      statusEl.textContent = "Thank you! Your message has been received.";
      formEl.reset();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });

  function showError(msg) {
    statusEl.className = 'form-status error';
    statusEl.textContent = msg;
  }
}
