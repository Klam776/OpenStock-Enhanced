import nodemailer from 'nodemailer';
import {WELCOME_EMAIL_TEMPLATE, NEWS_SUMMARY_EMAIL_TEMPLATE, STOCK_ALERT_UPPER_EMAIL_TEMPLATE, STOCK_ALERT_LOWER_EMAIL_TEMPLATE} from "@/lib/nodemailer/templates";

// Verify transporter configuration
if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASSWORD) {
    console.warn('⚠️ NODEMAILER_EMAIL or NODEMAILER_PASSWORD is not set. Email functionality will not work.');
}

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_EMAIL!,
        pass: process.env.NODEMAILER_PASSWORD!,
    },
    // Add connection timeout and retry options
    pool: true,
    maxConnections: 1,
    maxMessages: 3,
})

// Verify connection on startup
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Nodemailer transporter verification failed:', error);
    } else {
        console.log('✅ Nodemailer transporter is ready to send emails');
    }
});

export const sendWelcomeEmail = async ({ email, name, intro }: WelcomeEmailData) => {
    try {
        if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASSWORD) {
            throw new Error('Email credentials not configured');
        }

        const htmlTemplate = WELCOME_EMAIL_TEMPLATE
            .replace('{{name}}', name)
            .replace('{{intro}}', intro);

        const mailOptions = {
            from: `"Openstock" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject: `Welcome to Openstock - your open-source stock market toolkit!`,
            text: 'Thanks for joining Openstock, an initiative by open dev society',
            html: htmlTemplate,
        }

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Welcome email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Failed to send welcome email:', error);
        throw error;
    }
}

export const sendNewsSummaryEmail = async (
    { email, date, newsContent }: { email: string; date: string; newsContent: string }
) => {
    try {
        if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASSWORD) {
            throw new Error('Email credentials not configured');
        }

        const htmlTemplate = NEWS_SUMMARY_EMAIL_TEMPLATE
            .replace('{{date}}', date)
            .replace('{{newsContent}}', newsContent);

        const mailOptions = {
            from: `"Openstock" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject: `📈 Market News Summary Today - ${date}`,
            text: `Today's market news summary from Openstock`,
            html: htmlTemplate,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ News summary email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Failed to send news summary email:', error);
        throw error;
    }
};

export const sendAlertEmail = async ({
    email,
    symbol,
    condition,
    targetPrice,
    currentPrice,
    triggeredAt,
}: {
    email: string;
    symbol: string;
    condition: 'ABOVE' | 'BELOW';
    targetPrice: number;
    currentPrice: number;
    triggeredAt: string;
}) => {
    try {
        if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASSWORD) {
            throw new Error('Email credentials not configured');
        }

        const template = condition === 'ABOVE' ? STOCK_ALERT_UPPER_EMAIL_TEMPLATE : STOCK_ALERT_LOWER_EMAIL_TEMPLATE;
        const priceColor = condition === 'ABOVE' ? '#10b981' : '#ef4444';
        const htmlTemplate = template
            .replace(/\{\{symbol\}\}/g, symbol)
            .replace(/\{\{company\}\}/g, symbol)
            .replace(/\{\{currentPrice\}\}/g, `$${currentPrice.toFixed(2)}`)
            .replace(/\{\{targetPrice\}\}/g, `$${targetPrice.toFixed(2)}`)
            .replace(/\{\{timestamp\}\}/g, triggeredAt)
            .replace(/\{\{priceColor\}\}/g, priceColor);

        const subject = condition === 'ABOVE'
            ? `📈 Price Alert: ${symbol} exceeded $${targetPrice}`
            : `📉 Price Alert: ${symbol} dropped below $${targetPrice}`;

        const info = await transporter.sendMail({
            from: `"Openstock" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject,
            text: `${symbol} price alert triggered. Current price: $${currentPrice.toFixed(2)}`,
            html: htmlTemplate,
        });
        console.log('✅ Alert email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Failed to send alert email:', error);
        throw error;
    }
};