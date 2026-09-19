import React, { useEffect, useRef, useState } from 'react';
import { Mic, RefreshCw, Square, Sparkles } from 'lucide-react';
import { parseVoiceTrip } from '../lib/geminiVoice.js';

const MAX_RECORDING_MS = 10_000;

function preferredMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find(type => MediaRecorder.isTypeSupported?.(type)) || '';
}

export default function VoiceTripButton({ stationNames, onIntent }) {
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const stopTimerRef = useRef(null);
  const [phase, setPhase] = useState('idle');
  const [detail, setDetail] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => () => {
    window.clearTimeout(stopTimerRef.current);
    streamRef.current?.getTracks?.().forEach(track => track.stop());
  }, []);

  const finishRecording = () => {
    window.clearTimeout(stopTimerRef.current);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const beginRecording = async () => {
    setDetail('');
    setResult(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setDetail('Voice recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = preferredMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setPhase('error');
        setDetail('Microphone recording failed. Please try again.');
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        if (!blob.size) {
          setPhase('error');
          setDetail('No audio was captured. Please try again.');
          return;
        }

        setPhase('processing');
        setDetail('Gemini is identifying your start and destination…');
        try {
          const intent = await parseVoiceTrip(blob, stationNames);
          const applied = await onIntent(intent);
          setResult({ ...intent, ...applied });
          setPhase('success');
          setDetail('');
        } catch (error) {
          setPhase('error');
          setDetail(error?.message || 'Voice planning failed. Please try again.');
        }
      };

      recorder.start();
      setPhase('recording');
      setDetail('Listening… say something like “Bring me from Buona Vista to Serangoon.”');
      stopTimerRef.current = window.setTimeout(finishRecording, MAX_RECORDING_MS);
    } catch (error) {
      setPhase('error');
      setDetail(error?.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow microphone access and try again.'
        : 'PulseRoute could not access the microphone.');
    }
  };

  return (
    <div className="voice-trip-control">
      <button
        type="button"
        className={`voice-trip-button ${phase === 'recording' ? 'recording' : ''}`}
        onClick={phase === 'recording' ? finishRecording : beginRecording}
        disabled={phase === 'processing'}
      >
        {phase === 'recording'
          ? <><Square size={16} /> Stop & plan</>
          : phase === 'processing'
            ? <><RefreshCw className="spin" size={16} /> Understanding…</>
            : <><Mic size={17} /> Plan with voice</>}
      </button>
      {(detail || result) && (
        <div className={`voice-trip-status ${phase}`}>
          {result ? (
            <>
              <Sparkles size={15} />
              <span>
                {result.transcript && <small>Heard: “{result.transcript}”</small>}
                <b>{result.origin} → {result.destination}</b>
                <small>Voice intent understood with Gemini. PulseRoute is planning this journey.</small>
              </span>
            </>
          ) : (
            <>
              {phase === 'recording' ? <span className="voice-pulse" /> : <Mic size={15} />}
              <span>{detail}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
