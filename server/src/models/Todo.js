import mongoose from 'mongoose';

const MAX_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;

const todoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [1, 'Title cannot be empty'],
      maxlength: [MAX_TITLE_LENGTH, `Title cannot exceed ${MAX_TITLE_LENGTH} characters`],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [MAX_NOTES_LENGTH, `Notes cannot exceed ${MAX_NOTES_LENGTH} characters`],
    },
    completed: {
      type: Boolean,
      default: false,
    },
    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high'],
        message: 'Priority must be one of: low, medium, high',
      },
      default: 'medium',
    },
    dueDate: {
      type: Date,
      default: null,
      validate: {
        validator(value) {
          return value === null || value instanceof Date;
        },
        message: 'dueDate must be a valid date',
      },
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator(tags) {
          return (
            Array.isArray(tags) &&
            tags.length <= 20 &&
            tags.every((t) => typeof t === 'string' && t.trim().length > 0 && t.trim().length <= 30)
          );
        },
        message: 'Tags must be an array of up to 20 non-empty strings (max 30 chars each)',
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: false,
      versionKey: false,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  }
);

// Case-insensitive index on title to speed up search; uniqueness is NOT
// enforced — duplicate titles are legitimate for a to-do list.
todoSchema.index({ title: 'text' });
todoSchema.index({ completed: 1, createdAt: -1 });
todoSchema.index({ dueDate: 1 });

export const Todo = mongoose.model('Todo', todoSchema);
export { MAX_TITLE_LENGTH, MAX_NOTES_LENGTH };
