/**
 * Script de test pour l'envoi d'email MJML via Resend
 * Usage: npx ts-node src/email/test-email.ts
 */

import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const mjml2html: (mjml: string) => { html: string; errors: unknown[] } =
  require('mjml');

async function testEmail() {
  console.log('🚀 Test d\'envoi d\'email MJML...\n');

  // Configuration
  const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_SFaUind3_8EaPFYvvJk1xH2vAbtrMJqag';
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const TO_EMAIL = process.env.TEST_EMAIL || 'sahranedev@gmail.com'; // Change avec ton email
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

  console.log(`📧 From: ${FROM_EMAIL}`);
  console.log(`📬 To: ${TO_EMAIL}`);
  console.log(`🔗 Frontend URL: ${FRONTEND_URL}\n`);

  // Charger le template MJML
  const templatePath = path.join(__dirname, 'templates', 'verification-email.mjml');
  console.log(`📄 Chargement du template: ${templatePath}`);

  if (!fs.existsSync(templatePath)) {
    console.error('❌ Template non trouvé!');
    process.exit(1);
  }

  const mjmlContent = fs.readFileSync(templatePath, 'utf-8');
  console.log('✅ Template chargé\n');

  // Compiler MJML → HTML
  console.log('⚙️ Compilation MJML → HTML...');
  const result = mjml2html(mjmlContent);

  if (result.errors && result.errors.length > 0) {
    console.warn('⚠️ Warnings MJML:', result.errors);
  }
  console.log('✅ Compilation réussie\n');

  // Remplacer les placeholders
  const testToken = 'test-token-123456';
  const verificationUrl = `${FRONTEND_URL}/verify-email?token=${testToken}`;

  let html = result.html;
  html = html.replace(/\{\{VERIFICATION_URL\}\}/g, verificationUrl);
  html = html.replace(/\{\{USER_EMAIL\}\}/g, TO_EMAIL);

  console.log(`🔗 URL de vérification: ${verificationUrl}\n`);

  // Envoyer via Resend
  console.log('📤 Envoi via Resend...');
  const resend = new Resend(RESEND_API_KEY);

  try {
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject: '🎮 [TEST] Vérifiez votre email - Core Defender',
      html,
    });

    console.log('\n✅ Email envoyé avec succès!');
    console.log('📋 Réponse Resend:', JSON.stringify(response, null, 2));
    console.log(`\n📬 Vérifie ta boîte mail: ${TO_EMAIL}`);
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'envoi:', error);
    process.exit(1);
  }
}

testEmail();
