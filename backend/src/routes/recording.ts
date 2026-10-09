import { Router } from 'express';
import { startRecording, stopRecording, isRecording } from '../recording.js';

export const recordingRouter = Router();

recordingRouter.get('/', (req, res) => {
  res.json({ recording: isRecording(req.user!.id) });
});

recordingRouter.post('/start', (req, res) => {
  try {
    startRecording(req.user!.id, req.user!.username);
    res.status(201).json({ recording: true });
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

recordingRouter.post('/stop', async (req, res) => {
  try {
    await stopRecording(req.user!.id);
    res.status(200).json({ recording: false });
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
