import React, { useEffect, useRef, useState } from 'react';
import { Character } from '../types';
import { decode, decodeAudioData, float32ToPcmBase64 } from '../services/audioUtils';
import { Mic, MicOff, PhoneOff, Video, Activity, AlertCircle } from 'lucide-react';

interface LiveCallProps {
  character: Character;
  onEndCall: () => void;
}

// Map characters to fitting prebuilt voices
const getVoiceForCharacter = (charId: string): string => {
  const femaleChars = [
    'sakura', 'hinata', 'ino', 'temari', 'tsunade', 'konan',
    'nezuko', 'kanao', 'shinobu', 'mitsuri', 'kanae', 'tamayo',
    'spider_mother', 'aoi', 'sumi_kiyo_naho', 'daki', 'nakime',
    'makima', 'yor', 'rem'
  ];
  if (femaleChars.includes(charId)) {
    return 'Kore';
  }

  const energeticChars = [
    'naruto', 'rock_lee', 'might_guy', 'kiba', 'choji', 'deidara', 'killer_bee',
    'tanjiro', 'zenitsu', 'inosuke', 'uzui', 'rengoku', 'genya', 'kaigaku',
    'murata', 'kotetsu', 'luffy', 'goku'
  ];
  if (energeticChars.includes(charId)) {
    return 'Puck';
  }

  const deepOrCalmChars = [
    'sasuke', 'kakashi', 'shino', 'shikamaru', 'neji', 'gaara', 'kankuro',
    'jiraiya', 'orochimaru', 'minato', 'itachi', 'hashirama', 'pain',
    'kisame', 'obito', 'madara', 'kurama',
    'giyu', 'muichiro', 'obanai', 'sanemi', 'gyomei', 'urokodaki', 'jigoro',
    'kagaya', 'muzan', 'akaza', 'doma', 'kokushibo', 'gyutaro', 'rui', 'enmu',
    'yushiro', 'hand_demon', 'haganezuka', 'yoriichi', 'sabito',
    'gojo', 'zoro', 'levi', 'light'
  ];
  if (deepOrCalmChars.includes(charId)) {
    return 'Zephyr';
  }
  return 'Zephyr';
};

const LiveCall: React.FC<LiveCallProps> = ({ character, onEndCall }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'closed'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [volume, setVolume] = useState(0); // For visualizer

  // Audio & Connection Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const isMutedRef = useRef(false);

  // Keep isMutedRef in sync with state for callbacks
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    let cleanup = false;

    const initLiveSession = async () => {
      try {
        setStatus('connecting');
        setErrorMessage('');

        // 1. Setup Audio Contexts
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        inputAudioContextRef.current = new AudioCtx({ sampleRate: 16000 });
        outputAudioContextRef.current = new AudioCtx({ sampleRate: 24000 });

        // Ensure contexts are running (some browsers start in suspended mode)
        if (inputAudioContextRef.current.state === 'suspended') {
          await inputAudioContextRef.current.resume();
        }
        if (outputAudioContextRef.current.state === 'suspended') {
          await outputAudioContextRef.current.resume();
        }

        const outputNode = outputAudioContextRef.current.createGain();
        outputNode.connect(outputAudioContextRef.current.destination);

        // 2. Get Microphone Stream
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;

        // 3. Connect to Backend WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/live-ws`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cleanup) return;
          console.log('Live WebSocket connection established');

          // Send initialization payload with character instruction and chosen voice
          const voiceName = getVoiceForCharacter(character.id);
          ws.send(
            JSON.stringify({
              type: 'init',
              systemInstruction: character.systemInstruction,
              voiceName,
            })
          );

          // Setup mic audio processing pipeline
          if (!inputAudioContextRef.current) return;
          const source = inputAudioContextRef.current.createMediaStreamSource(stream);
          const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);

          scriptProcessor.onaudioprocess = (e) => {
            if (cleanup || isMutedRef.current || ws.readyState !== WebSocket.OPEN) return;

            const inputData = e.inputBuffer.getChannelData(0);

            // Calculate volume for visualizer
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
              sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);
            setVolume((prev) => prev * 0.75 + rms * 6 * 0.25);

            const pcmBase64 = float32ToPcmBase64(inputData);
            ws.send(
              JSON.stringify({
                type: 'audio',
                audio: pcmBase64,
              })
            );
          };

          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContextRef.current.destination);
        };

        ws.onmessage = async (event) => {
          if (cleanup) return;
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'connected') {
              setStatus('connected');
            } else if (data.type === 'audio' && data.audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

              const audioBuffer = await decodeAudioData(
                decode(data.audio),
                ctx,
                24000,
                1
              );

              const sourceNode = ctx.createBufferSource();
              sourceNode.buffer = audioBuffer;
              sourceNode.connect(outputNode);
              sourceNode.addEventListener('ended', () => {
                sourcesRef.current.delete(sourceNode);
              });

              sourceNode.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(sourceNode);
            } else if (data.type === 'interrupted') {
              sourcesRef.current.forEach((src) => {
                try {
                  src.stop();
                } catch (e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            } else if (data.type === 'error') {
              console.error('Server reported error:', data.error);
              setStatus('error');
              setErrorMessage(data.error || 'Live connection error occurred');
            } else if (data.type === 'closed') {
              setStatus('closed');
            }
          } catch (e) {
            console.error('Error parsing WS message:', e);
          }
        };

        ws.onerror = (err) => {
          console.error('Live WebSocket error:', err);
          if (!cleanup) {
            setStatus('error');
            setErrorMessage('Unable to connect to live voice server.');
          }
        };

        ws.onclose = () => {
          if (!cleanup) {
            setStatus('closed');
          }
        };
      } catch (err: any) {
        console.error('Failed to start live session:', err);
        if (!cleanup) {
          setStatus('error');
          setErrorMessage(err?.message || 'Failed to initialize microphone or live session.');
        }
      }
    };

    initLiveSession();

    return () => {
      cleanup = true;
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      inputAudioContextRef.current?.close().catch(() => {});
      outputAudioContextRef.current?.close().catch(() => {});
      sourcesRef.current.forEach((src) => {
        try {
          src.stop();
        } catch (e) {}
      });
      sourcesRef.current.clear();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [character.id]);

  const getPulseSize = () => {
    return 1 + Math.min(volume, 0.45);
  };

  return (
    <div className="flex flex-col h-full bg-black/90 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 opacity-25 bg-gradient-to-br from-indigo-950 via-gray-950 to-black"></div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full space-y-8 p-6">
        {/* Character Avatar with Ripple Effect */}
        <div className="relative group">
          <div
            className="absolute inset-0 rounded-full bg-yellow-400/30 blur-2xl"
            style={{
              transform: `scale(${getPulseSize()})`,
              transition: 'transform 0.1s ease-out',
            }}
          ></div>
          <img
            src={character.avatarUrl}
            alt={character.name}
            className="w-48 h-48 md:w-60 md:h-60 rounded-full object-cover border-4 border-yellow-400/80 shadow-2xl relative z-10"
          />
          <div
            className={`absolute bottom-2 right-2 w-6 h-6 rounded-full border-2 border-black ${
              status === 'connected'
                ? 'bg-green-500 ring-2 ring-green-400/50'
                : status === 'error'
                ? 'bg-red-500'
                : 'bg-yellow-500 animate-pulse'
            } z-20`}
          ></div>
        </div>

        <div className="text-center space-y-2">
          {character.group && (
            <span className="inline-block text-[11px] uppercase tracking-wider text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-3 py-0.5 rounded-full font-medium">
              {character.anime} • {character.group}
            </span>
          )}
          <h2 className="text-3xl md:text-4xl font-bold text-white font-anime tracking-wider">
            {character.name}
          </h2>
          <p className="text-gray-300 text-lg opacity-90">
            {status === 'connected'
              ? isMuted
                ? 'Muted (Click mic to speak)'
                : 'Listening & Responding...'
              : status === 'connecting'
              ? 'Connecting to Live Voice...'
              : status === 'closed'
              ? 'Call ended'
              : 'Connection Error'}
          </p>
        </div>

        {/* Status Messages */}
        {status === 'error' && (
          <div className="bg-red-500/20 text-red-200 px-4 py-2 rounded-lg border border-red-500/50 flex items-center gap-2 max-w-md text-sm text-center">
            <AlertCircle size={18} className="shrink-0" />
            <span>{errorMessage || 'Connection error. Please check microphone permissions.'}</span>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center space-x-6 mt-8">
          <button
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? 'Unmute' : 'Mute'}
            className={`p-4 rounded-full transition-all shadow-md ${
              isMuted
                ? 'bg-white text-black'
                : 'bg-gray-800 text-white hover:bg-gray-700'
            }`}
          >
            {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
          </button>

          <button
            onClick={onEndCall}
            title="End Call"
            className="p-6 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg transform hover:scale-105 transition-all"
          >
            <PhoneOff size={36} fill="white" />
          </button>

          <div
            title="Video not available"
            className="p-4 rounded-full bg-gray-800 text-gray-500 cursor-not-allowed"
          >
            <Video size={28} />
          </div>
        </div>

        <div className="absolute bottom-8 flex items-center space-x-2 text-white/40 text-sm">
          <Activity size={16} />
          <span>Gemini 3.8 Live Stream • 24kHz</span>
        </div>
      </div>
    </div>
  );
};

export default LiveCall;
