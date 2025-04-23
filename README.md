# Cloudflare Contact Form Worker

A serverless contact form powered by Cloudflare Workers that includes bot protection, email notifications, and Discord notifications.  This is purposefully done in one file to make it as easy as possible for someone to copy and paste.  I also purposefully kept it copy and past so someone can literally create a worker, edit the code, and paste this right in.  Will eventually move to "Deploy with Cloudflare"

## Features

- Simple, responsive contact form
- Bot protection with Cloudflare Turnstile
- Email notifications via Mailgun
- Discord webhook notifications
- Secure storage of sensitive information

## Prerequisites

Before you can use this worker, you'll need:

1. A [Cloudflare account](https://dash.cloudflare.com/sign-up)
2. A [Mailgun account](https://signup.mailgun.com/new/signup) with a verified domain
3. (Optional) A Discord server with a webhook URL

## Setup Instructions

### 1. Create a Cloudflare Worker

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages**
3. Click **Create Application** > **Create Worker**
4. Give your worker a name (e.g., "contactform")
5. Copy and paste the [worker code](https://github.com/schenanigans/cfworker-contactform/blob/main/worker.js) into the editor
6. Click **Save and Deploy**

### 2. Set Up Cloudflare Turnstile

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Security** > **Turnstile**
3. Click **Add Site**
4. Enter a name and select the domains where your form will be hosted
5. Choose the appropriate widget type (usually "Managed Challenge")
6. Copy the **Site Key** and **Secret Key** (you'll need these later)

### 3. Create KV Namespaces

You need to create two KV namespaces:

#### For Turnstile Keys
1. In the Cloudflare Dashboard, navigate to **Workers & Pages** > **KV**
2. Click **Create Namespace**
3. Name it `turnstile_kv`
4. Click **Add Key**
5. Create a key called `site-key-contactform` with your Turnstile Site Key as the value
6. Create another key called `secret-key-contactform` with your Turnstile Secret Key as the value

#### For Discord Webhook URL
1. Create another KV namespace named `Discord_Urls`
2. Add a key called `cloudflare-contactform` with your Discord webhook URL as the value (if you're using Discord notifications)

### 4. Set Up Secret Store

1. In the Cloudflare Dashboard, navigate to **Workers & Pages** > **Secret Store**
2. Click **Create Secret Store**
3. Give it a name (e.g., "contact-form-secrets")
4. Create the following secrets:
   - `mailgunApiKey`: Your Mailgun API key
   - `mailgunDomain`: Your Mailgun domain
   - `cloudflareEmail`: The email where you want to receive notifications
   - `senderEmail`: The email to send from (e.g., `postmaster@yourdomain.com`)

### 5. Bind Resources to Your Worker

1. Navigate to your worker
2. Go to **Settings** > **Variables**
3. Under **KV Namespace Bindings**, add:
   - Variable name: `turnstile_kv`, KV namespace: `turnstile_kv`
   - Variable name: `Discord_Urls`, KV namespace: `Discord_Urls`
4. Under **Secret Store Bindings**, add:
   - Variable name: `mailgunApiKey`, Secret name: `mailgunApiKey`
   - Variable name: `mailgunDomain`, Secret name: `mailgunDomain`
   - Variable name: `cloudflareEmail`, Secret name: `cloudflareEmail`
   - Variable name: `senderEmail`, Secret name: `senderEmail`
5. Click **Save**

### 6. Test Your Form

Visit your worker's URL (e.g., `https://contactform.yourworker.workers.dev`) to see and test your contact form.

## Customization

- You can customize the form's appearance by modifying the CSS in the `htmlTemplate` variable.
- You can adjust the email template in the `sendEmail` function.
- You can modify the Discord notification format in the `sendDiscordNotification` function.

## Troubleshooting

- If email notifications aren't working, check your Mailgun domain verification status and API key.
- For Discord notification issues, verify your webhook URL is correct in the KV store.
- Check the worker logs in the Cloudflare Dashboard for detailed error messages.

## Technologies Used

- **Cloudflare Workers**: Serverless JavaScript environment
- **Cloudflare Turnstile**: Bot protection
- **Cloudflare Secret Store**: Secure storage for sensitive information
- **Cloudflare Workers KV**: Low-latency data storage
- **Mailgun**: Email delivery service
- **Discord Webhooks**: Chat notifications

## License

This code is provided under the MIT License.
