import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = "TaskMaster <onboarding@resend.dev>"

const BRAND = "#bb67e4"
const BRAND_DARK = "#9333ea"
// Always use the production Vercel URL for email images — data: URIs are blocked by Gmail/Outlook
const LOGO_URL = "https://taskmasstar.vercel.app/logo.png"
const APP_URL = process.env.NEXTAUTH_URL ?? "https://taskmasstar.vercel.app"

function baseTemplate(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Task Master</title>
</head>
<body style="margin:0;padding:0;background:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1d1d1f;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f7;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header — mirrors the app nav: logo.png + "Task Master" -->
        <tr>
          <td style="background:linear-gradient(135deg,${BRAND_DARK},${BRAND});padding:28px 32px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="${LOGO_URL}" alt="Task Master" width="36" height="36" style="display:block;border-radius:8px;">
                </td>
                <td style="padding-left:10px;vertical-align:middle;">
                  <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Task Master</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f0f0f0;font-size:12px;color:#999;line-height:1.6;">
            You're receiving this because you have TaskMaster notifications enabled.<br>
            <a href="${APP_URL}/settings" style="color:${BRAND};text-decoration:none;">Manage notification preferences</a>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function badge(color: string, bg: string, text: string) {
  return `<div style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 12px;border-radius:20px;margin-bottom:16px;background:${bg};color:${color};">${text}</div>`
}

function taskCard(title: string, meta?: string) {
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;background:#f7f2fd;border-radius:12px;border-left:4px solid ${BRAND};overflow:hidden;">
    <tr><td style="padding:16px 20px;">
      <div style="font-size:16px;font-weight:700;color:#1d1d1f;margin-bottom:${meta ? "4px" : "0"};">${title}</div>
      ${meta ? `<div style="font-size:13px;color:#888;">${meta}</div>` : ""}
    </td></tr>
  </table>`
}

function ctaButton(text: string, url: string) {
  return `<a href="${url}" style="display:inline-block;background:${BRAND_DARK};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:15px;margin:8px 0;">${text}</a>`
}

export async function sendTaskReminderEmail(opts: {
  to: string
  userName: string
  taskTitle: string
  taskId: string
  dueTime: string
  minutesBefore: number
}) {
  const { to, userName, taskTitle, taskId, dueTime, minutesBefore } = opts
  const label = minutesBefore <= 5 ? "5 minutes" : minutesBefore <= 15 ? "15 minutes" : minutesBefore <= 30 ? "30 minutes" : "1 hour"
  const url = `${APP_URL}/dashboard?task=${taskId}`
  const first = userName.split(" ")[0]

  return resend.emails.send({
    from: FROM,
    to,
    subject: `⏰ "${taskTitle}" is due in ${label}`,
    html: baseTemplate(`
      ${badge("#d97706", "#fef3c7", "⏰ Due in " + label)}
      <h1 style="font-size:22px;font-weight:800;line-height:1.25;margin:0 0 8px;color:#1d1d1f;">Don't forget, ${first}!</h1>
      <p style="font-size:15px;line-height:1.6;color:#555;margin:0 0 16px;">One of your tasks is coming up soon.</p>
      ${taskCard(taskTitle, `Due at ${dueTime}`)}
      ${ctaButton("View task →", url)}
    `),
  })
}

export async function sendTaskOverdueEmail(opts: {
  to: string
  userName: string
  taskTitle: string
  taskId: string
}) {
  const { to, userName, taskTitle, taskId } = opts
  const url = `${APP_URL}/dashboard?task=${taskId}`
  const first = userName.split(" ")[0]

  return resend.emails.send({
    from: FROM,
    to,
    subject: `⚠️ "${taskTitle}" is overdue`,
    html: baseTemplate(`
      ${badge("#dc2626", "#fee2e2", "⚠️ Overdue")}
      <h1 style="font-size:22px;font-weight:800;line-height:1.25;margin:0 0 8px;color:#1d1d1f;">Task past its deadline</h1>
      <p style="font-size:15px;line-height:1.6;color:#555;margin:0 0 16px;">Hey ${first}, this task didn't get completed in time.</p>
      ${taskCard(taskTitle, "This task is now overdue")}
      ${ctaButton("View &amp; resolve →", url)}
    `),
  })
}

export async function sendSharedTaskEmail(opts: {
  to: string
  recipientName: string
  senderName: string
  taskTitle: string
  taskDescription?: string
  shareToken: string
}) {
  const { to, recipientName, senderName, taskTitle, taskDescription, shareToken } = opts
  const shareUrl = `${APP_URL}/share/${shareToken}`
  const first = recipientName ? recipientName.split(" ")[0] : "there"

  return resend.emails.send({
    from: FROM,
    to,
    subject: `🔗 ${senderName} shared a task with you`,
    html: baseTemplate(`
      ${badge(BRAND_DARK, "#f3e8ff", "🔗 Shared task")}
      <h1 style="font-size:22px;font-weight:800;line-height:1.25;margin:0 0 8px;color:#1d1d1f;">You've got a shared task</h1>
      <p style="font-size:15px;line-height:1.6;color:#555;margin:0 0 4px;">Hey ${first}, <strong>${senderName}</strong> wants you to collaborate on a task.</p>
      ${taskCard(taskTitle, taskDescription)}
      ${ctaButton("View shared task →", shareUrl)}
      <p style="font-size:13px;color:#999;margin-top:16px;">No account needed to view. Sign up free to track this on your dashboard.</p>
    `),
  })
}

export async function sendWelcomeEmail(opts: { to: string; userName: string }) {
  const { to, userName } = opts
  const first = userName.split(" ")[0]

  return resend.emails.send({
    from: FROM,
    to,
    subject: `Welcome to TaskMaster, ${first}! 🎉`,
    html: baseTemplate(`
      ${badge("#059669", "#d1fae5", "🎉 Welcome")}
      <h1 style="font-size:22px;font-weight:800;line-height:1.25;margin:0 0 8px;color:#1d1d1f;">You're in, ${first}!</h1>
      <p style="font-size:15px;line-height:1.6;color:#555;margin:0 0 16px;">TaskMaster is your new home for getting things done — beautifully. Create tasks, set reminders, focus with Pomodoro mode, and share tasks with your team.</p>
      ${ctaButton("Go to your dashboard →", `${APP_URL}/dashboard`)}
    `),
  })
}
