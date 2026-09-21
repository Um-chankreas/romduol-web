import { lessonService } from '@/services/lessonService';
import api from '@/services/axios';

export const STAGE_UPLOAD = 'Uploading video';

/**
 * Save a class recording into the course: make a chapter, upload the video to
 * it, and link it to the live class (`recording_lesson_id`) — the same path the
 * OBS "Save class recording" flow uses, so either kind of recording shows up
 * in the class's replay.
 *
 * Every step is remembered on `state`, so calling this again with the same
 * `state` after a failure resumes where it stopped instead of creating a second
 * chapter or re-uploading a finished video. Pass a fresh `{}` for a new file.
 *
 * @param {{ courseId, liveClassId, title: string, file: File, state?: object,
 *           onStage?: (s: string) => void, onProgress?: (pct: number) => void }} opts
 * @returns {Promise<number|string>} the lesson (chapter) id
 */
export async function saveRecordingToCourse({ courseId, liveClassId, title, file, state = {}, onStage = () => {}, onProgress = () => {} }) {
  if (!state.lessonId) {
    onStage('Creating chapter…');
    const created = await lessonService.createLesson(courseId, title, '', null);
    state.lessonId = (created.data?.lesson || created.data || created.lesson).id;
  }
  if (!state.uploaded) {
    onStage(STAGE_UPLOAD);
    onProgress(0);
    await lessonService.uploadLessonVideo(state.lessonId, file, { onProgress: (p) => onProgress(Math.round(p)) });
    state.uploaded = true;
    state.linked = false;
  }
  if (!state.linked) {
    onStage('Linking recording…');
    await api.put(`/live-classes/${liveClassId}/recording`, { lesson_id: state.lessonId });
    state.linked = true;
  }
  return state.lessonId;
}
