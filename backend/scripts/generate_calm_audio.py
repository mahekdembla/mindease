import os
import math
import struct
import wave

def generate_calm_ambient_audio(output_path: str):
    sample_rate = 22050
    duration = 4.0  # 4-second seamless loop
    num_samples = int(sample_rate * duration)
    
    # Gentle 432Hz harmonic ambient chord (432Hz, 540Hz, 648Hz, 864Hz)
    freqs = [432.0, 540.0, 648.0, 864.0]
    weights = [0.4, 0.25, 0.2, 0.15]
    
    audio_data = bytearray()
    
    for i in range(num_samples):
        t = i / sample_rate
        
        # Smooth breathing envelope modulation (slow 0.25Hz pulse)
        envelope = 0.85 + 0.15 * math.sin(2 * math.pi * 0.25 * t)
        
        sample_val = 0.0
        for f, w in zip(freqs, weights):
            sample_val += w * math.sin(2 * math.pi * f * t)
            
        final_val = sample_val * envelope * 0.15  # Low volume (15%)
        
        # 16-bit signed integer PCM [-32768, 32767]
        pcm_val = int(max(-32768, min(32767, final_val * 32767)))
        audio_data.extend(struct.pack('<h', pcm_val))
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with wave.open(output_path, 'wb') as wav_file:
        wav_file.setnchannels(1)      # Mono
        wav_file.setsampwidth(2)      # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_data)
        
    print(f"Successfully generated ambient audio at {output_path}")

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "public", "audio", "calm-ambient.mp3")
    generate_calm_ambient_audio(out)
