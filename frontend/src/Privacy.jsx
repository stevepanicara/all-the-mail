import React from 'react';
import './landing.css';

function Privacy() {
  return (
    <div className="landing">
      <div className="landing-container" style={{ maxWidth: '800px' }}>
        <div style={{ padding: '40px 20px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: '900', marginBottom: '16px' }}>Privacy Policy</h1>
          <p style={{ opacity: 0.6, marginBottom: '40px' }}>Last updated: February 1, 2026</p>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Introduction</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              ALL THE MAIL ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our email management application.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Information We Collect</h2>
            
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Account Information</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              When you sign in with Google, we collect:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Your Google account email address</li>
              <li>Your name and profile picture</li>
              <li>OAuth access tokens for Gmail API access</li>
            </ul>

            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Email Data</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              To provide our email management service, we access:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Email messages from your connected Gmail accounts</li>
              <li>Email metadata (sender, subject, date, labels)</li>
              <li>Email content (body, attachments)</li>
              <li>Draft emails you create within the app</li>
            </ul>

            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Usage Information</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              We collect information about how you use ALL THE MAIL, including:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Feature usage and preferences</li>
              <li>Search queries within the app</li>
              <li>Technical data (browser type, IP address, device information)</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>How We Use Your Information</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              We use your information to:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Provide and maintain the ALL THE MAIL service</li>
              <li>Display your emails in a unified interface</li>
              <li>Send, receive, archive, and delete emails on your behalf</li>
              <li>Authenticate your access to the application</li>
              <li>Process payments and manage subscriptions</li>
              <li>Improve and optimize our service</li>
              <li>Respond to your support requests</li>
              <li>Send important service updates and security notifications</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Data Storage and Security</h2>
            
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Where We Store Data</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              Your data is stored using:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Supabase (PostgreSQL database) for account information and OAuth tokens</li>
              <li>Gmail servers (your emails remain on Google's servers)</li>
            </ul>

            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Security Measures</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              We implement industry-standard security measures:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>AES-256-GCM encryption for OAuth tokens</li>
              <li>HTTPS encryption for all data transmission</li>
              <li>Secure cookie-based authentication</li>
              <li>Regular security audits and updates</li>
            </ul>

            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              <strong>Important:</strong> We do not permanently store your email content on our servers. Emails are fetched in real-time from Gmail and displayed in your browser.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Data Sharing and Disclosure</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              We do not sell, trade, or rent your personal information to third parties.
            </p>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              We may share your information only in the following circumstances:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li><strong>Service Providers:</strong> With trusted third-party services (Supabase, Stripe) that help us operate the application</li>
              <li><strong>Legal Requirements:</strong> When required by law, legal process, or government request</li>
              <li><strong>Protection of Rights:</strong> To protect our rights, privacy, safety, or property, and that of our users</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Your Rights and Choices</h2>
            
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Access and Control</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              You have the right to:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Access your personal information</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Revoke Gmail access permissions at any time</li>
              <li>Export your data</li>
              <li>Opt out of marketing communications</li>
            </ul>

            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Revoking Access</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              You can revoke ALL THE MAIL's access to your Gmail account at any time by:
            </p>
            <ol style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Visiting your Google Account permissions page</li>
              <li>Selecting "ALL THE MAIL"</li>
              <li>Clicking "Remove Access"</li>
            </ol>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              Alternatively, you can delete your ALL THE MAIL account from within the application settings.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Cookies and Tracking</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              We use cookies and similar technologies to:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Keep you signed in</li>
              <li>Remember your preferences</li>
              <li>Analyze usage patterns to improve our service</li>
            </ul>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              You can control cookies through your browser settings, but disabling cookies may affect functionality.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Data Retention</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              We retain your information for as long as your account is active or as needed to provide services. When you delete your account:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Your account data is immediately deleted from our database</li>
              <li>OAuth tokens are securely destroyed</li>
              <li>Backup copies are purged within 30 days</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Children's Privacy</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              ALL THE MAIL is not intended for users under 13 years of age. We do not knowingly collect personal information from children under 13. If we discover that we have collected information from a child under 13, we will delete it immediately.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>International Users</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              ALL THE MAIL is operated in the United States. If you are located outside the U.S., your information will be transferred to and processed in the U.S. By using our service, you consent to this transfer.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Changes to This Policy</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              We may update this Privacy Policy from time to time. We will notify you of any material changes by:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Posting the new Privacy Policy on this page</li>
              <li>Updating the "Last updated" date</li>
              <li>Sending you an email notification (for significant changes)</li>
            </ul>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              Your continued use of ALL THE MAIL after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Contact Us</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              If you have questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              Email: privacy@allthemail.io
            </p>
          </section>

          <div style={{ marginTop: '60px', paddingTop: '40px', borderTop: '1px solid #222' }}>
            <a href="/" style={{ color: '#CDFF00', textDecoration: 'none', fontWeight: '600' }}>
              ← Back to ALL THE MAIL
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Privacy;
