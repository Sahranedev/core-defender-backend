import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const mjml2html: (mjml: string) => MjmlResult = require('mjml');

interface MjmlResult {
  html: string;
  errors: Array<{ message: string; line: number }>;
}

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  /**
   * Charge et compile un template MJML
   */
  private loadTemplate(templateName: string): string {
    const templatePath = path.join(
      __dirname,
      'templates',
      `${templateName}.mjml`,
    );
    const mjmlContent = fs.readFileSync(templatePath, 'utf-8');
    const result = mjml2html(mjmlContent);

    if (result.errors && result.errors.length > 0) {
      console.error('MJML compilation errors:', result.errors);
    }

    return result.html;
  }

  /**
   * Remplace les placeholders dans le HTML
   */
  private replacePlaceholders(
    html: string,
    variables: Record<string, string>,
  ): string {
    let result = html;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  /**
   * Envoie l'email de vérification
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${this.frontendUrl}/verify-email?token=${token}`;

    // Charger et compiler le template MJML
    let html = this.loadTemplate('verification-email');

    // Remplacer les variables
    html = this.replacePlaceholders(html, {
      VERIFICATION_URL: verificationUrl,
      USER_EMAIL: email,
    });

    // Envoyer l'email via Resend
    await this.resend.emails.send({
      from: this.fromEmail,
      to: email,
      subject: '🎮 Vérifiez votre email - Core Defender',
      html,
    });
  }

  /**
   * Envoie un email de bienvenue après vérification
   */
  async sendWelcomeEmail(email: string, firstname: string): Promise<void> {
    // Template inline simple pour le welcome (optionnel)
    const html = `
      <div style="background-color: #0f172a; padding: 40px; font-family: sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; padding: 40px;">
          <h1 style="color: #60a5fa; text-align: center; font-size: 32px; margin-bottom: 20px;">
            🎮 Bienvenue sur Core Defender !
          </h1>
          <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6;">
            Félicitations <strong style="color: #60a5fa;">${firstname}</strong> ! 
            Votre compte a été vérifié avec succès.
          </p>
          <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">
            Vous êtes maintenant prêt à entrer dans l'arène et défendre votre Core !
          </p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${this.frontendUrl}/arene" 
               style="background-color: #3b82f6; color: white; padding: 16px 40px; 
                      text-decoration: none; border-radius: 10px; font-weight: bold; 
                      font-size: 18px; display: inline-block;">
              ⚔️ Rejoindre l'arène
            </a>
          </div>
          <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 40px;">
            © 2026 Core Defender - Tous droits réservés
          </p>
        </div>
      </div>
    `;

    await this.resend.emails.send({
      from: this.fromEmail,
      to: email,
      subject: '🏆 Bienvenue Commandant ! - Core Defender',
      html,
    });
  }

  /**
   * Envoie une invitation à rejoindre une partie
   */
  async sendGameInvitation(
    email: string,
    roomId: string,
    inviterName: string,
  ): Promise<void> {
    const gameUrl = `${this.frontendUrl}/game/${roomId}`;

    const html = `
      <div style="background-color: #0f172a; padding: 40px; font-family: sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; padding: 40px;">
          <h1 style="color: #60a5fa; text-align: center; font-size: 28px; margin-bottom: 20px;">
            🎮 Invitation à une partie !
          </h1>
          <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; text-align: center;">
            <strong style="color: #a855f7;">${inviterName}</strong> vous défie sur Core Defender !
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${gameUrl}" 
               style="background-color: #22c55e; color: white; padding: 16px 40px; 
                      text-decoration: none; border-radius: 10px; font-weight: bold; 
                      font-size: 18px; display: inline-block;">
              ⚔️ Accepter le défi
            </a>
          </div>
          <p style="color: #64748b; font-size: 13px; text-align: center;">
            Room ID: <code style="color: #60a5fa;">${roomId}</code>
          </p>
          <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 40px;">
            © 2026 Core Defender - Tous droits réservés
          </p>
        </div>
      </div>
    `;

    await this.resend.emails.send({
      from: this.fromEmail,
      to: email,
      subject: `⚔️ ${inviterName} vous défie ! - Core Defender`,
      html,
    });
  }
}
