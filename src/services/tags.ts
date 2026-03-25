import * as queries from '../db/queries';
import type { Tag } from '../db/schema';

const TAG_COLORS = [
  '#e57373', '#f06292', '#ba68c8', '#9575cd',
  '#7986cb', '#64b5f6', '#4fc3f7', '#4dd0e1',
  '#4db6ac', '#81c784', '#aed581', '#dce775',
  '#fff176', '#ffd54f', '#ffb74d', '#ff8a65',
];

export async function getOrCreateTag(name: string): Promise<Tag> {
  const allTags = await queries.getAllTags();
  const existing = allTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;

  const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
  return queries.createTag(name.toLowerCase(), color);
}

export async function toggleTagOnRecording(recordingId: string, tagId: string): Promise<void> {
  const currentTags = await queries.getTagsForRecording(recordingId);
  const hasTag = currentTags.some((t) => t.id === tagId);

  if (hasTag) {
    await queries.removeTagFromRecording(recordingId, tagId);
  } else {
    await queries.addTagToRecording(recordingId, tagId);
  }
}
