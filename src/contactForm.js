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
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, type, message, consent: true, pageSlug: 'home', website: '' }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      statusEl.className = 'form-status success';
      statusEl.textContent = "Thank you! I've received your message and will reply within 48 hours.";
      formEl.reset();
    } catch (err) {
      console.warn('API submission failed, offering mailto fallback:', err);
      statusEl.className = 'form-status error';
      statusEl.innerHTML = `
        Message could not be submitted via API. Please email directly at 
        <a href="mailto:shyam@example.com?subject=${encodeURIComponent(type + ' enquiry from ' + name)}&body=${encodeURIComponent(message)}" style="color: #fff; text-decoration: underline;">
          shyam@example.com
        </a>
      `;
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
