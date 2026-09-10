import '../src/load-env.js';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { prisma } from '../src/db.js';
import { Role, TicketStatus, TicketCategory, SenderType } from '../src/generated/prisma/enums.js';

const SUPPORT_EMAIL = 'support@ashcombe.edu';
const AGENT_SEED_PASSWORD = 'AgentPass123!';
const TOTAL_TICKETS = 100;

const AGENTS = [
  { name: 'Maria Chen', email: 'maria.chen@ashcombe.edu' },
  { name: 'James Okafor', email: 'james.okafor@ashcombe.edu' },
  { name: 'Sara Ibrahim', email: 'sara.ibrahim@ashcombe.edu' },
  { name: 'Tom Becker', email: 'tom.becker@ashcombe.edu' },
];

const FIRST_NAMES = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'Lucas',
  'Mia', 'Elijah', 'Charlotte', 'James', 'Amelia', 'Benjamin', 'Harper', 'Henry', 'Evelyn',
  'Alexander', 'Abigail', 'Sebastian', 'Emily', 'Jack', 'Elizabeth', 'Owen', 'Sofia', 'Daniel',
  'Avery', 'Matthew', 'Ella', 'Joseph', 'Scarlett', 'Samuel', 'Grace', 'David', 'Chloe',
  'Carter', 'Victoria', 'Wyatt', 'Priya', 'Wei', 'Fatima', 'Diego', 'Aaliyah', 'Kenji',
];

const LAST_NAMES = [
  'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez',
  'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor',
  'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez',
  'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright',
  'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Patel', 'Kim', 'Okafor', 'Haddad',
];

const EMAIL_DOMAINS = ['ashcombe.edu', 'ashcombe.edu', 'ashcombe.edu', 'gmail.com', 'outlook.com'];

const COURSES = ['BIO 201', 'CHEM 110', 'ECON 301', 'PSY 150', 'MATH 220', 'ENG 105', 'HIST 240', 'CS 330'];
const AMOUNTS = ['$1,240.00', '$450.00', '$89.99', '$2,015.50', '$150.00', '$60.00', '$320.00'];
const MAJORS = ['Biology', 'Computer Science', 'Economics', 'Psychology', 'Mechanical Engineering', 'English', 'History'];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function randomStudent(usedEmails: Set<string>) {
  const firstName = randomFrom(FIRST_NAMES);
  const lastName = randomFrom(LAST_NAMES);
  const name = `${firstName} ${lastName}`;
  const domain = randomFrom(EMAIL_DOMAINS);
  let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
  let suffix = 1;
  while (usedEmails.has(email)) {
    suffix += 1;
    email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${suffix}@${domain}`;
  }
  usedEmails.add(email);
  return { name, firstName, email };
}

function randomDateWithinLastDays(days: number): Date {
  const now = Date.now();
  const offsetMs = randomInt(0, days) * 24 * 60 * 60 * 1000 + randomInt(0, 24 * 60 * 60 * 1000);
  return new Date(now - offsetMs);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

type Ctx = { name: string; firstName: string };
type Rendered = { subject: string; body: string; resolution: string };
type Template = { category: TicketCategory; render: (ctx: Ctx) => Rendered };

const templates: Template[] = [
  // General questions
  {
    category: TicketCategory.generalQuestion,
    render: ({ name, firstName }) => ({
      subject: 'Question about the add/drop deadline',
      body: `Hi,\n\nI'm trying to figure out the last day I can drop ${randomFrom(COURSES)} without it showing up on my transcript. The registrar page wasn't clear on this. Can someone confirm the exact date for this semester?\n\nThanks,\n${name}`,
      resolution: `Hi ${firstName},\n\nThe add/drop deadline for this semester is the end of week 3 (see the academic calendar on the portal). Dropping before then won't appear on your transcript at all. Let us know if you need anything else!\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.generalQuestion,
    render: ({ name, firstName }) => ({
      subject: "Can't find my class schedule for next semester",
      body: `Hello,\n\nRegistration opened this week but I don't see an option to view or build my schedule for next semester on the portal. Is this a permissions issue on my account, or is registration not open for my class year yet?\n\n${name}`,
      resolution: `Hi ${firstName},\n\nRegistration opens by class year — seniors and juniors first, then sophomores and first-years. Your window opens later this week. Once it's open, you'll see "Register for Classes" under the Academics tab. Nothing wrong with your account.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.generalQuestion,
    render: ({ name, firstName }) => ({
      subject: `How do I change my major to ${randomFrom(MAJORS)}?`,
      body: `Hi there,\n\nI'd like to switch my major to ${randomFrom(MAJORS)}. Do I need to meet with my advisor first, or can I submit the change request directly through the portal?\n\nThanks,\n${name}`,
      resolution: `Hi ${firstName},\n\nYou'll need to meet with your current advisor first to sign off, then submit the Change of Major form under Academics > Forms. Once your advisor approves it electronically, the registrar processes it within 3-5 business days.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.generalQuestion,
    render: ({ name, firstName }) => ({
      subject: 'Requesting an official transcript',
      body: `Hello,\n\nI need an official transcript sent to a grad school application portal by the end of the month. How do I request that, and is there a rush option?\n\n${name}`,
      resolution: `Hi ${firstName},\n\nYou can request official transcripts under Academics > Transcripts — electronic delivery usually arrives within 1-2 business days. There's a rush option for an extra fee if you need same-day processing. Let me know if the portal gives you any trouble.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.generalQuestion,
    render: ({ name, firstName }) => ({
      subject: 'Roommate/housing assignment question',
      body: `Hi,\n\nI just got my housing assignment but no roommate is listed yet. Does that mean I have a single, or is the roommate match still pending? Move-in is coming up fast and I'd like to plan ahead.\n\n${name}`,
      resolution: `Hi ${firstName},\n\nRoommate matches are still being finalized for a portion of the incoming class — you should see an update within the next week. If nothing shows up by move-in day, it likely means you were assigned a single. I'll flag your assignment with Housing to double check.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.generalQuestion,
    render: ({ name, firstName }) => ({
      subject: 'How do I add funds to my meal plan?',
      body: `Hello,\n\nI'm running low on dining dollars and want to add more before the semester ends. I can't find where to do this on the portal — is it under the dining site or the student account site?\n\n${name}`,
      resolution: `Hi ${firstName},\n\nYou can add dining dollars anytime under Student Account > Meal Plan > Add Funds — it posts to your card within a few minutes. Note that dining dollars don't roll over to next semester, so only add what you'll use.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.generalQuestion,
    render: ({ name, firstName }) => ({
      subject: 'Graduation application requirements',
      body: `Hi,\n\nI'm planning to graduate in the spring and want to make sure I don't miss anything. What's the process for applying for graduation, and is there a deadline?\n\nThanks,\n${name}`,
      resolution: `Hi ${firstName},\n\nThe graduation application opens under Academics > Apply to Graduate, and the deadline for spring graduates is typically early October. It also runs a degree audit automatically so you'll see right away if any requirements are outstanding.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },

  // Technical questions
  {
    category: TicketCategory.technicalQuestion,
    render: ({ name, firstName }) => ({
      subject: "Can't log into the student portal",
      body: `Hi,\n\nI keep getting "invalid credentials" when logging into the student portal, even after resetting my password twice. I can log into my email fine with the same password. Can you help me get back in?\n\n${name}`,
      resolution: `Hi ${firstName},\n\nThis was caused by a stale session token on our end — I've cleared it manually. Please try logging in again with your current password, and let me know if the issue comes back.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.technicalQuestion,
    render: ({ name, firstName }) => ({
      subject: `Assignment submission failing in ${randomFrom(COURSES)} course site`,
      body: `Hello,\n\nI'm trying to upload my assignment for ${randomFrom(COURSES)} but the upload bar hangs at 90% and then times out. I've tried two different browsers and a smaller file. The deadline is tonight — can someone help?\n\n${name}`,
      resolution: `Hi ${firstName},\n\nThere was a temporary storage issue on the course site server that's now fixed. I've confirmed your file uploaded successfully and time-stamped it at your original submission time so it won't be marked late. Sorry for the trouble!\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.technicalQuestion,
    render: ({ name, firstName }) => ({
      subject: 'Dorm wifi keeps disconnecting',
      body: `Hi,\n\nThe wifi in my dorm room has been dropping every 10-15 minutes for the past two days, which is making it impossible to attend online classes. Other rooms on my floor seem fine. Room 214, Fenwick Hall.\n\n${name}`,
      resolution: `Hi ${firstName},\n\nOur network team found a failing access point near Fenwick 214 and swapped it out this afternoon. Your connection should be stable now — please let us know if you still see drops after a reboot of your device.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.technicalQuestion,
    render: ({ name, firstName }) => ({
      subject: 'University email not syncing on my phone',
      body: `Hello,\n\nMy university email stopped syncing on my phone's mail app two days ago — I have to log into webmail to see new messages. I've removed and re-added the account twice already.\n\n${name}`,
      resolution: `Hi ${firstName},\n\nThis was likely caused by an expired app password after our recent security update. Please generate a new app-specific password from Account Settings > Security and use that instead of your normal password when re-adding the account. That should resolve the sync issue.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.technicalQuestion,
    render: ({ name, firstName }) => ({
      subject: "Can't print from the library computers",
      body: `Hi,\n\nI'm at the library trying to print a paper due in an hour and it says my print quota is at zero, but I haven't printed anything all semester. Can someone check my account?\n\n${name}`,
      resolution: `Hi ${firstName},\n\nYour print quota was accidentally reset by a batch job we ran this morning — apologies for the bad timing. I've restored your balance and added a small credit for the inconvenience. You should be able to print now.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.technicalQuestion,
    render: ({ name, firstName }) => ({
      subject: `Recorded lecture video won't play for ${randomFrom(COURSES)}`,
      body: `Hello,\n\nThe recorded lecture for ${randomFrom(COURSES)} from this week just spins and never loads, on both Chrome and Safari. I need to watch it before the quiz tomorrow.\n\n${name}`,
      resolution: `Hi ${firstName},\n\nThat recording had failed to finish processing on the video server — I've re-triggered it and confirmed it now plays back correctly. Sorry for the delay, and good luck on the quiz!\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.technicalQuestion,
    render: ({ name, firstName }) => ({
      subject: 'Two-factor authentication app not receiving codes',
      body: `Hi,\n\nI got a new phone and my authenticator app no longer has my university account set up, so I can't get past the 2FA prompt to log in anywhere. How do I get this reset?\n\n${name}`,
      resolution: `Hi ${firstName},\n\nI've reset your 2FA enrollment after verifying your identity over the phone. Next time you log in, you'll be prompted to set up a new authenticator device. Let us know if you'd like help with that step.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },

  // Refund requests
  {
    category: TicketCategory.refundRequest,
    render: ({ name, firstName }) => ({
      subject: `Refund request after dropping ${randomFrom(COURSES)}`,
      body: `Hi,\n\nI dropped ${randomFrom(COURSES)} within the refund window but I'm still showing the full ${randomFrom(AMOUNTS)} charge on my student account. Can someone process the refund or let me know what's holding it up?\n\n${name}`,
      resolution: `Hi ${firstName},\n\nI checked your account and confirmed the drop was within the refund window. I've submitted the refund to Student Accounts — it should post to your account within 5-7 business days.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.refundRequest,
    render: ({ name, firstName }) => ({
      subject: 'Charged twice for my parking permit',
      body: `Hello,\n\nI just noticed two identical charges of $180 for my fall parking permit on my student account. I only registered one vehicle. Can you refund the duplicate charge?\n\n${name}`,
      resolution: `Hi ${firstName},\n\nYou're right — this was a known double-billing glitch from the parking portal migration. I've refunded the duplicate $180 charge; it should show up on your account within a few business days.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.refundRequest,
    render: ({ name, firstName }) => ({
      subject: 'Requesting prorated housing refund after withdrawal',
      body: `Hi,\n\nI withdrew from the university two weeks into the semester and moved out of my dorm the same week. I understand housing refunds are prorated — can you tell me what I'm owed and when I'll see it?\n\n${name}`,
      resolution: `Hi ${firstName},\n\nBased on your move-out date, you're owed a prorated refund of ${randomFrom(AMOUNTS)} for the remaining weeks of housing. I've submitted this to Student Accounts, and it should be refunded to your original payment method within 10 business days.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.refundRequest,
    render: ({ name, firstName }) => ({
      subject: 'Meal plan refund after moving off campus',
      body: `Hello,\n\nI got approved to move off campus mid-semester and was told my unused meal plan balance would be refunded. It's been three weeks and I haven't seen anything. Can you check on this?\n\n${name}`,
      resolution: `Hi ${firstName},\n\nI see the approval on file but the refund request never made it to Student Accounts due to a processing error on our end — I've resubmitted it now with your remaining balance of ${randomFrom(AMOUNTS)}. You should see it within a week, and I apologize for the delay.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.refundRequest,
    render: ({ name, firstName }) => ({
      subject: `Duplicate charge for ${randomFrom(COURSES)} lab fee`,
      body: `Hi,\n\nMy student account shows the ${randomFrom(COURSES)} lab fee charged twice this semester, once at registration and once again last week. I only have one lab section. Please refund the extra charge.\n\n${name}`,
      resolution: `Hi ${firstName},\n\nConfirmed — this was applied twice due to a scheduling sync issue between the registrar and billing systems. I've reversed the duplicate lab fee; it'll reflect on your account balance right away.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.refundRequest,
    render: ({ name, firstName }) => ({
      subject: 'Disputing a late registration fee',
      body: `Hello,\n\nI was charged a $75 late registration fee, but I registered before the deadline — I have the confirmation email with a timestamp to prove it. Can this be reviewed and refunded?\n\n${name}`,
      resolution: `Hi ${firstName},\n\nThanks for sending the confirmation email — I compared the timestamp against the deadline and you're correct, this was charged in error. I've reversed the $75 fee from your account.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
  {
    category: TicketCategory.refundRequest,
    render: ({ name, firstName }) => ({
      subject: 'Health insurance waiver not applied — need refund',
      body: `Hi,\n\nI submitted my health insurance waiver with proof of outside coverage before the deadline, but I was still charged ${randomFrom(AMOUNTS)} for the student health plan. Can this be corrected?\n\n${name}`,
      resolution: `Hi ${firstName},\n\nI checked with the Health Services office and confirmed your waiver was approved but hadn't synced to the billing system yet. The charge has been reversed and should reflect on your account within 3-5 business days.\n\nBest,\nAshcombe Helpdesk`,
    }),
  },
];

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== Role.admin) {
      await prisma.user.update({ where: { email }, data: { role: Role.admin } });
      console.log(`Updated existing user ${email} to admin role.`);
    } else {
      console.log(`Admin user ${email} already exists, skipping.`);
    }
    return;
  }

  const userId = randomUUID();
  const hashed = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      id: userId,
      name: 'Admin',
      email,
      emailVerified: true,
      role: Role.admin,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: userId,
          providerId: 'credential',
          password: hashed,
        },
      },
    },
  });

  console.log(`Created admin user ${user.email} (${user.id})`);
}

async function seedAgents(): Promise<{ id: string; name: string; email: string }[]> {
  const records: { id: string; name: string; email: string }[] = [];

  for (const agent of AGENTS) {
    const existing = await prisma.user.findUnique({ where: { email: agent.email } });
    if (existing) {
      console.log(`Agent ${agent.email} already exists, skipping.`);
      records.push({ id: existing.id, name: existing.name, email: existing.email });
      continue;
    }

    const userId = randomUUID();
    const hashed = await hashPassword(AGENT_SEED_PASSWORD);

    const user = await prisma.user.create({
      data: {
        id: userId,
        name: agent.name,
        email: agent.email,
        emailVerified: true,
        role: Role.agent,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: userId,
            providerId: 'credential',
            password: hashed,
          },
        },
      },
    });

    console.log(`Created agent ${user.email} (${user.id})`);
    records.push({ id: user.id, name: user.name, email: user.email });
  }

  return records;
}

async function seedTickets(agentRecords: { id: string; name: string; email: string }[]) {
  const existingCount = await prisma.ticket.count();
  if (existingCount > 0) {
    console.log(`Found ${existingCount} existing ticket(s), skipping ticket seed.`);
    return;
  }

  const usedEmails = new Set<string>();

  for (let i = 0; i < TOTAL_TICKETS; i++) {
    const template = randomFrom(templates);
    const student = randomStudent(usedEmails);
    const rendered = template.render({ name: student.name, firstName: student.firstName });
    const createdAt = randomDateWithinLastDays(90);

    const statusRoll = Math.random();
    const status =
      statusRoll < 0.35 ? TicketStatus.open : statusRoll < 0.7 ? TicketStatus.resolved : TicketStatus.closed;

    const needsAgent = status !== TicketStatus.open || Math.random() < 0.55;
    const assignedAgent = needsAgent ? randomFrom(agentRecords) : null;

    // A small share of tickets haven't been triaged into a category yet.
    const category = Math.random() < 0.05 ? null : template.category;

    const messages = [
      {
        fromEmail: student.email,
        fromName: student.name,
        toEmail: SUPPORT_EMAIL,
        body: rendered.body,
        createdAt,
      },
    ];

    const replies: { senderType: SenderType; authorId: string; body: string; createdAt: Date }[] = [];
    let lastActivity = createdAt;

    if (status !== TicketStatus.open && assignedAgent) {
      const resolvedAt = addHours(createdAt, randomInt(3, 96));
      replies.push({
        senderType: SenderType.agent,
        authorId: assignedAgent.id,
        body: rendered.resolution,
        createdAt: resolvedAt,
      });
      lastActivity = resolvedAt;
    } else if (assignedAgent && Math.random() < 0.5) {
      const ackAt = addHours(createdAt, randomInt(1, 24));
      replies.push({
        senderType: SenderType.agent,
        authorId: assignedAgent.id,
        body: `Hi ${student.firstName}, thanks for reaching out — I'm looking into this and will follow up shortly.`,
        createdAt: ackAt,
      });
      lastActivity = ackAt;
    }

    await prisma.ticket.create({
      data: {
        subject: rendered.subject,
        status,
        category,
        requesterEmail: student.email,
        requesterName: student.name,
        assignedAgentId: assignedAgent?.id ?? null,
        createdAt,
        updatedAt: lastActivity,
        messages: { create: messages },
        replies: { create: replies },
      },
    });

    if ((i + 1) % 20 === 0) {
      console.log(`Seeded ${i + 1}/${TOTAL_TICKETS} tickets...`);
    }
  }

  console.log(`Seeded ${TOTAL_TICKETS} tickets.`);
}

async function main() {
  await seedAdmin();
  const agentRecords = await seedAgents();
  await seedTickets(agentRecords);
  console.log(`\nSeed agent login password (for any newly created agents): ${AGENT_SEED_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
