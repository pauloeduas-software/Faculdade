import React, { useState, ChangeEvent } from 'react';
import { Upload, FileText, Image as ImageIcon, Loader2, Copy, Check, Trash2, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Header } from './components/Header';
import { extractTextFromImage } from './services/ocrService';

export default function App() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!preview) return;
    setLoading(true);
    setResult('');
    setProgress(0);
    setStatusText('Iniciando...');

    try {
      const extractedText = await extractTextFromImage(preview, (prog, status) => {
        setProgress(prog);
        setStatusText(status);
      });
      setResult(extractedText);
    } catch (error: any) {
      setResult('Erro: ' + error.message);
    } finally {
      setLoading(false);
      setProgress(100);
      setStatusText('Concluído');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setImage(null);
    setPreview(null);
    setResult('');
    setProgress(0);
    setStatusText('');
  };

  return (
    <div className="fixed inset-0 bg-[#020617] text-slate-100 overflow-hidden flex flex-col font-sans">
      <div className="mesh-bg opacity-20" />
      <div className="grid-bg opacity-5" />
      
      <Header />

      <div className="flex-grow flex flex-col lg:flex-row w-full overflow-hidden min-h-0">
        <div className="flex-grow flex flex-col min-h-0 h-full border-r border-white/5 relative bg-slate-900/10 overflow-hidden">
          <div className="flex-grow flex flex-col p-6 h-full relative overflow-hidden">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                    <Upload className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Input</h2>
              </div>
              {preview && (
                  <button onClick={reset} className="p-2 rounded-lg bg-red-500/5 hover:bg-red-500/10 text-slate-500 transition-all border border-red-500/10">
                    <Trash2 className="w-4 h-4" />
                  </button>
              )}
            </div>

            <div className="flex-grow relative min-h-0">
              <div className="absolute inset-0">
                {!preview ? (
                  <label className="w-full h-full border-2 border-dashed border-white/5 hover:border-indigo-500/20 rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all bg-white/[0.01] hover:bg-white/[0.02] group">
                    <div className="text-center p-8">
                      <ImageIcon className="w-16 h-16 text-indigo-500/10 mx-auto mb-4" />
                      <p className="text-sm font-bold text-slate-400">Arraste a Imagem</p>
                    </div>
                    <input type="file" className="hidden" onChange={onFileChange} accept="image/*" />
                  </label>
                ) : (
                  <div className="w-full h-full rounded-3xl overflow-hidden bg-black/30 border border-white/5 p-4 flex items-center justify-center">
                    <img src={preview} alt="Preview" className="max-w-full max-h-full object-contain shadow-2xl" />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex-shrink-0">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleUpload}
                disabled={!preview || loading}
                className={`w-full h-14 rounded-xl font-black text-xs tracking-[0.3em] transition-all flex items-center justify-center gap-3 relative overflow-hidden ${
                  !preview || loading ? 'bg-slate-800 text-slate-600' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {loading ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="tracking-widest uppercase">{statusText} {progress}%</span>
                  </div>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>EXTRAIR AGORA</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>

        <div className="flex-grow flex flex-col p-6 h-full min-h-0">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Output</h2>
            </div>
            {result && (
                <button onClick={copyToClipboard} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all font-black text-[10px] uppercase tracking-widest ${copied ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white/5 text-white border border-white/10'}`}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
            )}
          </div>

          <div className="flex-grow bg-black/40 rounded-3xl border border-white/5 shadow-inner overflow-hidden relative min-h-0">
            <textarea
              className="w-full h-full p-8 bg-transparent outline-none resize-none text-slate-200 font-mono text-xs lg:text-sm leading-relaxed custom-scrollbar selection:bg-emerald-500/30"
              value={result}
              readOnly
              placeholder="Aguardando..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
