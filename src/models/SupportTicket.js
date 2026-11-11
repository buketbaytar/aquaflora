import mongoose from 'mongoose';

export const TICKET_TYPES = ['return', 'exchange', 'live_support', 'order_issue', 'other'];
export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

const supportTicketSchema = new mongoose.Schema({
    ticketNumber: { type: String, unique: true },
    type: { type: String, enum: TICKET_TYPES, required: true },
    status: { type: String, enum: TICKET_STATUSES, default: 'open', index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    email: { type: String, lowercase: true, trim: true },
    phone: String,
    orderNumber: String,
    reason: String,
    message: { type: String, maxlength: 2000 },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatConversation' },
    adminNote: String
}, { timestamps: true });

export const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
