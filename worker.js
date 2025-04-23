// worker.js (ES Module format)
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET") {
      const siteKey = await env.turnstile_kv.get("site-key-contactform");
      const html = htmlTemplate.replace('SITE_KEY_PLACEHOLDER', siteKey || '');
      return new Response(html, {
        headers: { "Content-Type": "text/html;charset=UTF-8" },
      });
    }

    if (request.method === "POST" && url.pathname === "/submit") {
      try {
        const formData = await request.formData();
        const errors = validateFormData(formData);

        if (errors) {
          return new Response(JSON.stringify({ success: false, errors }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        const turnstileToken = formData.get("cf-turnstile-response");
        const turnstileSecretKey = await env.turnstile_kv.get("secret-key-contactform");
        const clientIP = request.headers.get("CF-Connecting-IP");

        const isTokenValid = await verifyTurnstileToken(
          turnstileToken,
          turnstileSecretKey,
          clientIP
        );

        if (!isTokenValid) {
          return new Response(JSON.stringify({
            success: false,
            errors: { turnstile: "Security challenge failed. Please try again." }
          }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        // Get secret values with await
        const mailgunApiKey = await env.mailgunApiKey.get();
        const mailgunDomain = await env.mailgunDomain.get();
        const cloudflareEmail = await env.cloudflareEmail.get();
        const senderEmail = await env.senderEmail.get();
        
        console.log(`Email routing - From: ${senderEmail}, To: ${cloudflareEmail}`);
        console.log(`Mailgun Domain: ${mailgunDomain}`);

        const emailSent = await sendEmail(
          mailgunApiKey,
          mailgunDomain,
          cloudflareEmail,
          senderEmail,
          formData
        );

        let discordNotificationSent = false;
        const discordWebhookUrl = await env.Discord_Urls.get("cloudflare-contactform");

        if (discordWebhookUrl) {
          discordNotificationSent = await sendDiscordNotification(discordWebhookUrl, formData);
        } else {
          console.warn("Missing Discord webhook URL in KV: Discord_Urls/cloudflare-contactform");
        }

        console.log(`Notification results - Email: ${emailSent}, Discord: ${discordNotificationSent}`);

        if (emailSent || discordNotificationSent) {
          return new Response(JSON.stringify({
            success: true,
            message: "Form submitted successfully!"
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        } else {
          return new Response(JSON.stringify({
            success: false,
            message: "Failed to process form submission. Please try again later."
          }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      } catch (error) {
        console.error("Form processing error:", error);
        return new Response(JSON.stringify({
          success: false,
          message: "An unexpected error occurred."
        }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    return new Response("Not found", { status: 404 });
  }
};

// JavaScript to handle form submission dynamically
const script = `
<script>
  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("contact-form");
    const successMessage = document.getElementById("success-message");
    
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const formData = new FormData(form);
      const response = await fetch("/submit", {
        method: "POST",
        body: formData
      });
      const result = await response.json();
      if (result.success) {
        // Show success message and hide the form
        successMessage.style.display = "block";
        form.style.display = "none";
        
        // Add technology info section
        const techInfo = document.createElement("div");
        techInfo.className = "tech-info";
        techInfo.innerHTML = \`
          <h3>This contact form is using:</h3>
          <ul>
            <li><strong>Cloudflare Workers</strong> - Cloudflare's Serverless Platform (<a href="https://developers.cloudflare.com/workers/" target="_blank">Learn more</a>)</li>
            <li><strong>Cloudflare Turnstile</strong> - Smart Captcha Replacement (<a href="https://developers.cloudflare.com/turnstile/" target="_blank">Learn more</a>)</li>
            <li><strong>Cloudflare Secret Store</strong> - Reusable Secrets Account Wide (<a href="https://developers.cloudflare.com/secrets-store/" target="_blank">Learn more</a>)</li>
            <li><strong>Cloudflare Workers KV</strong> - Low-latency data storage (<a href="https://developers.cloudflare.com/kv/" target="_blank">Learn more</a>)</li>
          </ul>
        \`;
        
        // Add a reset button to show the form again
        const resetButton = document.createElement("button");
        resetButton.innerText = "Submit Another Message";
        resetButton.className = "reset-button";
        resetButton.onclick = function() {
          form.reset();
          form.style.display = "block";
          successMessage.style.display = "none";
          techInfo.remove();
          document.querySelector(".reset-button")?.remove();
          // Reset turnstile if it exists
          if (typeof turnstile !== 'undefined') {
            turnstile.reset();
          }
        };
        
        // Add the tech info and reset button after the success message
        successMessage.after(techInfo);
        techInfo.after(resetButton);
      } else {
        if (result.errors) {
          // Display specific field errors
          Object.keys(result.errors).forEach(field => {
            const errorEl = document.getElementById(\`\${field}-error\`);
            if (errorEl) errorEl.textContent = result.errors[field];
          });
        } else {
          // Display generic error
          alert(result.message || "Something went wrong.");
        }
      }
    });
  });
</script>
`;

// Inject script before closing body tag in htmlTemplate
const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Contact Form</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; color: #232323; }
    h1 { color: #003682; }
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-weight: bold; color: #333; }
    input, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    textarea { height: 100px; }
    .required:after { content: " *"; color: #F6821F; }
    button { background-color: #F6821F; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
    button:hover { background-color: #e67313; }
    .error { color: #F6821F; font-size: 0.9em; margin-top: 5px; }
    .success { color: #003682; padding: 15px; background-color: #e9f7ef; border-radius: 4px; margin-bottom: 20px; font-weight: bold; border-left: 4px solid #003682; }
    .reset-button { margin-top: 15px; background-color: #2C7CB0; }
    .reset-button:hover { background-color: #256a95; }
    .tech-info { margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 4px; border-left: 4px solid #F6821F; }
    .tech-info h3 { margin-top: 0; color: #003682; }
    .tech-info ul { padding-left: 20px; }
    .tech-info a { color: #2C7CB0; text-decoration: none; }
    .tech-info a:hover { text-decoration: underline; color: #F6821F; }
    .tech-info li { margin-bottom: 8px; }
    .tech-info strong { color: #003682; }
  </style>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head>
<body>
  <h1>Contact</h1>
  <div id="success-message" class="success" style="display: none;">
    Your message has been sent successfully! We'll get back to you soon.
  </div>
  <form id="contact-form" method="POST" action="/submit">
    <div class="form-group">
      <label for="firstName" class="required">First Name</label>
      <input type="text" id="firstName" name="firstName" required>
      <div class="error" id="firstName-error"></div>
    </div>
    <div class="form-group">
      <label for="lastName" class="required">Last Name</label>
      <input type="text" id="lastName" name="lastName" required>
      <div class="error" id="lastName-error"></div>
    </div>
    <div class="form-group">
      <label for="email" class="required">Email Address</label>
      <input type="email" id="email" name="email" required>
      <div class="error" id="email-error"></div>
    </div>
    <div class="form-group">
      <label for="phone">Phone Number (Optional)</label>
      <input type="tel" id="phone" name="phone">
    </div>
    <div class="form-group">
      <label for="comment" class="required">Comment</label>
      <textarea id="comment" name="comment" placeholder="Please let me know what you'd like to discuss" required></textarea>
      <div class="error" id="comment-error"></div>
    </div>
    <div class="form-group">
      <div class="cf-turnstile" data-sitekey="SITE_KEY_PLACEHOLDER"></div>
      <div class="error" id="turnstile-error"></div>
    </div>
    <button type="submit">Submit</button>
  </form>
  ${script}
</body>
</html>`;


function validateFormData(formData) {
  const errors = {};
  const requiredFields = ['firstName', 'lastName', 'email', 'comment'];
  requiredFields.forEach(field => {
    if (!formData.get(field)?.trim()) {
      errors[field] = 'This field is required.';
    }
  });

  const email = formData.get('email');
  if (email && !/^[\w.-]+@[\w.-]+\.[\w.-]+$/.test(email)) {
    errors['email'] = 'Please enter a valid email address.';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

async function verifyTurnstileToken(token, secretKey, ip) {
  const formData = new FormData();
  formData.append('secret', secretKey);
  formData.append('response', token);
  formData.append('remoteip', ip);

  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });

    const data = await result.json();
    return data.success;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

async function sendEmail(mailgunApiKey, mailgunDomain, cloudflareEmail, senderEmail, formData) {
  if (!mailgunApiKey || !mailgunDomain || !cloudflareEmail || !senderEmail) {
    console.error('Mailgun config missing:', {
      hasApiKey: Boolean(mailgunApiKey),
      hasDomain: Boolean(mailgunDomain),
      hasRecipientEmail: Boolean(cloudflareEmail),
      hasSenderEmail: Boolean(senderEmail)
    });
    return false;
  }

  const url = `https://api.mailgun.net/v3/${mailgunDomain}/messages`;
  console.log(`Sending email via Mailgun to URL: ${url}`);

  // Use URLSearchParams instead of FormData for better compatibility
  const emailParams = new URLSearchParams();
  emailParams.append('from', senderEmail);
  emailParams.append('to', cloudflareEmail);
  emailParams.append('subject', 'New Contact Form Submission');

  let emailBody = `New contact form submission:\n\n`;
  emailBody += `Name: ${formData.get('firstName')} ${formData.get('lastName')}\n`;
  emailBody += `Email: ${formData.get('email')}\n`;

  if (formData.get('phone')) {
    emailBody += `Phone: ${formData.get('phone')}\n`;
  }

  emailBody += `\nComment: ${formData.get('comment')}\n`;

  emailParams.append('text', emailBody);

  const authString = btoa(`api:${mailgunApiKey}`);

  try {
    console.log('Attempting to send email via Mailgun...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: emailParams
    });
    
    const responseText = await response.text();
    console.log(`Mailgun response status: ${response.status} ${response.statusText}`);
    console.log(`Mailgun response body: ${responseText}`);
    
    return response.ok;
  } catch (error) {
    console.error('Mailgun error:', error.message);
    return false;
  }
}

async function sendDiscordNotification(webhookUrl, formData) {
  try {
    const payload = {
      embeds: [{
        title: "New Contact Form Submission",
        color: 5814783,
        fields: [
          { name: "Name", value: `${formData.get('firstName')} ${formData.get('lastName')}`, inline: true },
          { name: "Email", value: formData.get('email'), inline: true },
          { name: "Phone", value: formData.get('phone') || "Not provided", inline: true },
          { name: "Comment", value: formData.get('comment') || "No comment provided" }
        ],
        timestamp: new Date().toISOString()
      }]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return response.ok;
  } catch (error) {
    console.error('Discord notification error:', error);
    return false;
  }
}
