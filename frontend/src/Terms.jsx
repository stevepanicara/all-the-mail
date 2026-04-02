import React from 'react';
import './landing.css';

function Terms() {
  return (
    <div className="landing">
      <div className="landing-container" style={{ maxWidth: '800px' }}>
        <div style={{ padding: '40px 20px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: '900', marginBottom: '16px' }}>Terms of Service</h1>
          <p style={{ opacity: 0.6, marginBottom: '40px' }}>Last updated: February 1, 2026</p>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Agreement to Terms</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              By accessing or using ALL THE MAIL, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, do not use our service.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Description of Service</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              ALL THE MAIL is an email management application that allows you to:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Connect multiple Gmail accounts</li>
              <li>View emails from all accounts in a unified interface</li>
              <li>Send, receive, archive, and delete emails</li>
              <li>Organize emails by category</li>
              <li>Search across all connected accounts</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Account Registration</h2>
            
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Eligibility</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              You must be at least 13 years old to use ALL THE MAIL. By creating an account, you represent that you meet this age requirement.
            </p>

            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Account Security</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              You are responsible for:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Maintaining the security of your Google account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized access</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Subscription Plans</h2>
            
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Free Tier</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              The free tier includes:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Connection of up to 2 Gmail accounts</li>
              <li>All core email management features</li>
              <li>14-day trial period</li>
            </ul>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              Emails sent from free tier accounts will include a "Sent with ALL THE MAIL" signature with a link to our service.
            </p>

            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Pro Subscription</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              Pro subscription ($7/month or $60/year) includes:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Unlimited Gmail account connections</li>
              <li>No signature on sent emails</li>
              <li>Priority support</li>
            </ul>

            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Free Trial</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              New users receive a 14-day free trial of Pro features. No credit card is required to start your trial. After the trial period:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>If you have not subscribed, you will automatically revert to the free tier</li>
              <li>Accounts beyond the 2-account limit will be disabled until you upgrade or remove accounts</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Billing and Payment</h2>
            
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Payment Processing</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              Payments are processed securely through Stripe. We do not store your full credit card information.
            </p>

            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Billing Cycle</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              Subscriptions are billed:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Monthly: $7 charged every month</li>
              <li>Annually: $60 charged once per year</li>
            </ul>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              Billing occurs on the same day each billing period. All fees are non-refundable except as required by law.
            </p>

            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Price Changes</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              We reserve the right to change our pricing. We will provide at least 30 days' notice of any price changes. Continued use of the service after a price change constitutes acceptance of the new pricing.
            </p>

            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Failed Payments</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              If a payment fails:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>We will attempt to charge your payment method up to 3 times</li>
              <li>You will receive email notifications about failed payments</li>
              <li>If payment continues to fail, your subscription will be canceled and you will revert to the free tier</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Cancellation and Refunds</h2>
            
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Canceling Your Subscription</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              You may cancel your subscription at any time from your account settings. Upon cancellation:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>You will retain Pro access until the end of your current billing period</li>
              <li>No further charges will be made</li>
              <li>You will automatically revert to the free tier</li>
            </ul>

            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Refund Policy</h3>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              All sales are final. We do not offer refunds except as required by law. If you experience technical issues, please contact support before canceling.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Acceptable Use</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              You agree not to use ALL THE MAIL to:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Violate any laws or regulations</li>
              <li>Send spam or unsolicited commercial emails</li>
              <li>Harass, abuse, or harm others</li>
              <li>Distribute malware or viruses</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Reverse engineer or decompile our software</li>
              <li>Use automated systems to scrape or access the service</li>
              <li>Impersonate others or misrepresent your affiliation</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Intellectual Property</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              ALL THE MAIL and its original content, features, and functionality are owned by us and are protected by international copyright, trademark, and other intellectual property laws.
            </p>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              You retain all rights to your email content. By using our service, you grant us a limited license to access, display, and transmit your emails solely for the purpose of providing the service.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Third-Party Services</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              ALL THE MAIL integrates with:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Google Gmail (for email access)</li>
              <li>Stripe (for payment processing)</li>
            </ul>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              Your use of these third-party services is subject to their respective terms and privacy policies. We are not responsible for the practices of third-party services.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Service Availability</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              We strive to provide reliable service but cannot guarantee:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Uninterrupted or error-free operation</li>
              <li>100% uptime or availability</li>
              <li>Compatibility with all devices or browsers</li>
            </ul>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              We reserve the right to modify, suspend, or discontinue the service at any time with reasonable notice.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Limitation of Liability</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              To the maximum extent permitted by law:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>ALL THE MAIL is provided "as is" without warranties of any kind</li>
              <li>We are not liable for any indirect, incidental, special, or consequential damages</li>
              <li>Our total liability shall not exceed the amount you paid us in the past 12 months</li>
              <li>We are not responsible for loss of data, emails, or business interruption</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Indemnification</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              You agree to indemnify and hold harmless ALL THE MAIL and its affiliates from any claims, damages, losses, or expenses (including legal fees) arising from:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Your use of the service</li>
              <li>Your violation of these terms</li>
              <li>Your violation of any rights of another party</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Termination</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              We may terminate or suspend your account immediately, without prior notice, if you:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Breach these Terms of Service</li>
              <li>Engage in fraudulent or illegal activities</li>
              <li>Violate our Acceptable Use policy</li>
            </ul>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              Upon termination, your right to use the service ceases immediately. You may delete your account at any time from account settings.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Governing Law</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Dispute Resolution</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              Any disputes arising from these Terms or your use of ALL THE MAIL will be resolved through:
            </p>
            <ol style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Good faith negotiation between the parties</li>
              <li>If negotiation fails, binding arbitration in accordance with applicable arbitration rules</li>
            </ol>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Changes to Terms</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              We reserve the right to modify these Terms at any time. We will notify you of material changes by:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Posting the updated Terms on this page</li>
              <li>Updating the "Last updated" date</li>
              <li>Sending email notification (for significant changes)</li>
            </ul>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              Your continued use after changes constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>Contact Information</h2>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              For questions about these Terms of Service, please contact us at:
            </p>
            <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>
              Email: legal@allthemail.io
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

export default Terms;
