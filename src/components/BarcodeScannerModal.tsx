"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, RefreshCw, AlertCircle, Zap, ZapOff, Search } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScanSuccess: (barcode: string) => void;
}

export default function BarcodeScannerModal({ isOpen, onClose, onScanSuccess }: BarcodeScannerModalProps) {
    const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string>('');
    const [loadingCameras, setLoadingCameras] = useState<boolean>(false);
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [torchOn, setTorchOn] = useState<boolean>(false);
    const [hasTorch, setHasTorch] = useState<boolean>(false);
    const [manualBarcode, setManualBarcode] = useState<string>('');
    
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const scannerId = "barcode-scanner-viewfinder";

    // Styles for scanning laser animation and viewfinder video centering
    const styleBlock = `
        @keyframes scan-laser {
            0% { top: 0%; }
            50% { top: 100%; }
            100% { top: 0%; }
        }
        .animate-scan-laser {
            animation: scan-laser 2.5s linear infinite;
        }
        #${scannerId} video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            object-position: center !important;
        }
    `;

    const stopScanning = useCallback(async () => {
        if (html5QrCodeRef.current) {
            try {
                if (html5QrCodeRef.current.isScanning) {
                    await html5QrCodeRef.current.stop();
                }
            } catch (err) {
                console.error("Error stopping html5QrCode:", err);
            } finally {
                html5QrCodeRef.current = null;
                setIsScanning(false);
                setTorchOn(false);
                setHasTorch(false);
            }
        }
    }, []);

    const startScanning = useCallback(async (cameraId: string) => {
        if (html5QrCodeRef.current?.isScanning) {
            await stopScanning();
        }

        setErrorMsg('');
        const html5QrCode = new Html5Qrcode(scannerId, {
            formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E
            ],
            verbose: false
        });
        html5QrCodeRef.current = html5QrCode;

        try {
            setIsScanning(true);
            await html5QrCode.start(
                cameraId,
                {
                    fps: 24,
                    qrbox: (width: number) => {
                        const boxWidth = Math.min(width * 0.85, 320);
                        const boxHeight = boxWidth * 0.5; // aspect ratio 2:1 for barcodes
                        return {
                            width: Math.round(boxWidth),
                            height: Math.round(boxHeight)
                        };
                    },
                    experimentalFeatures: {
                        useBarCodeDetectorIfSupported: true
                    },
                    useBarCodeDetectorIfSupported: true,
                    videoConstraints: {
                        deviceId: { exact: cameraId },
                        width: { min: 640, ideal: 1280, max: 1920 },
                        height: { min: 480, ideal: 720, max: 1080 },
                        aspectRatio: 1.7777777778
                    }
                } as unknown as Parameters<Html5Qrcode['start']>[1],
                (decodedText) => {
                    // Success callback
                    if (decodedText) {
                        // Play a feedback beep sound if possible
                        try {
                            const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
                            const osc = audioCtx.createOscillator();
                            const gain = audioCtx.createGain();
                            osc.connect(gain);
                            gain.connect(audioCtx.destination);
                            osc.type = "sine";
                            osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
                            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
                            osc.start();
                            osc.stop(audioCtx.currentTime + 0.1);
                        } catch (e) {
                            console.log("Audio beep failed:", e);
                        }
                        
                        onScanSuccess(decodedText.trim());
                        stopScanning();
                        onClose();
                    }
                },
                () => {
                    // Verbose scanning error, safe to ignore during normal viewfinder frame processing
                }
            );

            // Check if device supports torch
            try {
                const capabilities = html5QrCode.getRunningTrackCapabilities();
                setHasTorch(!!(capabilities as Record<string, unknown>).torch);
            } catch {
                setHasTorch(false);
            }
        } catch (err: unknown) {
            console.error("Error starting camera scanning:", err);
            setErrorMsg('Αποτυχία έναρξης της κάμερας. Ίσως χρησιμοποιείται από άλλη εφαρμογή.');
            setIsScanning(false);
        }
    }, [onClose, onScanSuccess, stopScanning]);

    // Fetch available cameras when modal opens
    useEffect(() => {
        if (!isOpen) return;

        const initCameras = async () => {
            setLoadingCameras(true);
            setErrorMsg('');
            try {
                // Request camera permission and list devices
                const devices = await Html5Qrcode.getCameras();
                if (devices && devices.length > 0) {
                    setCameras(devices);
                    
                    // Try to find a back camera automatically
                    const backCamera = devices.find(d => 
                        d.label.toLowerCase().includes('back') || 
                        d.label.toLowerCase().includes('environment') ||
                        d.label.toLowerCase().includes('rear') ||
                        d.label.toLowerCase().includes('πίσω')
                    );
                    
                    setSelectedCameraId(backCamera ? backCamera.id : devices[0].id);
                } else {
                    setErrorMsg('Δεν βρέθηκαν κάμερες στη συσκευή σας.');
                }
            } catch (err: unknown) {
                console.error("Error listing cameras:", err);
                setErrorMsg('Δεν δόθηκε άδεια πρόσβασης στην κάμερα. Παρακαλώ επιτρέψτε την πρόσβαση.');
            } finally {
                setLoadingCameras(false);
            }
        };

        initCameras();

        return () => {
            stopScanning();
        };
    }, [isOpen, stopScanning]);

    // Start scanning when camera is selected
    useEffect(() => {
        if (!isOpen || !selectedCameraId) return;

        const timer = setTimeout(() => {
            startScanning(selectedCameraId);
        }, 0);
        return () => clearTimeout(timer);
    }, [isOpen, selectedCameraId, startScanning]);

    const toggleTorch = async () => {
        if (!html5QrCodeRef.current || !hasTorch) return;
        try {
            const nextTorchState = !torchOn;
            await html5QrCodeRef.current.applyVideoConstraints({
                advanced: [{ torch: nextTorchState } as unknown as Record<string, unknown>]
            });
            setTorchOn(nextTorchState);
        } catch (err) {
            console.error("Error toggling torch:", err);
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualBarcode.trim()) {
            onScanSuccess(manualBarcode.trim());
            stopScanning();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <style>{styleBlock}</style>
            
            {/* Dark Backdrop Overlay */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => { stopScanning(); onClose(); }} />

            {/* Modal Body Container */}
            <div className="relative w-full max-w-md bg-panel-bg rounded-3xl border border-border-custom shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-5 border-b border-border-custom flex items-center justify-between bg-panel-bg">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500">
                            <Camera className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base leading-none">Scan & Compare</h3>
                            <span className="text-[10px] text-slate-400 font-semibold mt-1 block">Σάρωση Barcode Προϊόντος (EAN)</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => { stopScanning(); onClose(); }} 
                        className="p-2 hover:bg-input-custom text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Main Scanning Viewfinder */}
                <div className="relative bg-slate-950 flex-1 flex flex-col justify-center overflow-hidden aspect-[4/3] max-h-[300px]">
                    
                    {/* Viewfinder Target Container */}
                    <div id={scannerId} className="w-full h-full object-cover" />

                    {/* Viewfinder Scanning Grid Overlays */}
                    {isScanning && !errorMsg && (
                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                            {/* Pulsing automatic scanning badge */}
                            <div className="absolute top-4 left-4 z-25 flex items-center gap-1.5 bg-indigo-600 text-white text-[9px] font-extrabold px-2.5 py-1.5 rounded-full uppercase tracking-widest shadow-lg border border-indigo-400/20">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span>ΑΥΤΟΜΑΤΗ ΑΝΙΧΝΕΥΣΗ</span>
                            </div>

                            {/* Active rectangular barcode viewfinder border */}
                            <div className="relative z-10 w-[85%] max-w-[320px] h-[160px] border-2 border-indigo-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] overflow-hidden">
                                
                                {/* Scanning Laser Animation */}
                                <div className="absolute left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_red] animate-scan-laser" />
                                
                                {/* Corner indicators */}
                                <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-white rounded-tl-md" />
                                <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-white rounded-tr-md" />
                                <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-white rounded-bl-md" />
                                <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-white rounded-br-md" />
                            </div>

                            <p className="absolute bottom-4 text-center text-white text-[11px] font-bold tracking-wide bg-slate-900/90 px-3.5 py-2 rounded-full border border-slate-700/50 shadow-md z-10">
                                Ευθυγραμμίστε το barcode στο πλαίσιο • Σαρώνει αυτόματα
                            </p>
                        </div>
                    )}

                    {/* Loading view */}
                    {!isScanning && !errorMsg && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
                            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                            <span className="text-xs font-semibold">Εκκίνηση κάμερας...</span>
                        </div>
                    )}

                    {/* Error message view */}
                    {errorMsg && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-900 text-slate-300 gap-3">
                            <AlertCircle className="w-10 h-10 text-red-500" />
                            <p className="text-xs font-semibold max-w-xs">{errorMsg}</p>
                            {cameras.length > 0 && (
                                <button 
                                    onClick={() => startScanning(selectedCameraId)}
                                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition shadow cursor-pointer"
                                >
                                    Προσπάθεια ξανά
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Controls & Manual Input */}
                <div className="p-5 space-y-4 bg-panel-bg border-t border-border-custom overflow-y-auto">
                    
                    {/* Camera Select & Torch row */}
                    {cameras.length > 0 && (
                        <div className="flex gap-3 items-center">
                            <div className="flex-1 flex items-center bg-input-custom rounded-xl px-3 py-2 border border-border-custom">
                                <span className="text-[10px] text-slate-400 font-bold mr-2 uppercase shrink-0">Κάμερα:</span>
                                <select 
                                    value={selectedCameraId}
                                    onChange={(e) => setSelectedCameraId(e.target.value)}
                                    className="w-full text-xs font-semibold bg-transparent outline-none border-none text-slate-700 dark:text-slate-300 cursor-pointer"
                                    disabled={loadingCameras}
                                >
                                    {cameras.map((camera) => (
                                        <option key={camera.id} value={camera.id} className="dark:bg-slate-800">
                                            {camera.label || `Κάμερα ${cameras.indexOf(camera) + 1}`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {hasTorch && isScanning && (
                                <button 
                                    onClick={toggleTorch}
                                    className={`p-3.5 rounded-xl border border-border-custom transition flex items-center justify-center shrink-0 cursor-pointer ${
                                        torchOn 
                                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                                            : 'bg-input-custom text-slate-450 hover:text-slate-650 dark:hover:text-slate-250'
                                    }`}
                                    title="Ενεργοποίηση/Απενεργοποίηση Φακού"
                                >
                                    {torchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Separator / Manual entry title */}
                    <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-border-custom"></div>
                        <span className="flex-shrink mx-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ή Χειροκίνητη Εισαγωγή</span>
                        <div className="flex-grow border-t border-border-custom"></div>
                    </div>

                    {/* Manual Input Form */}
                    <form onSubmit={handleManualSubmit} className="flex gap-2">
                        <div className="relative flex-1">
                            <input 
                                type="text"
                                value={manualBarcode}
                                onChange={(e) => setManualBarcode(e.target.value.replace(/\D/g, ''))} // only digits
                                placeholder="Πληκτρολογήστε τον EAN κωδικό..."
                                className="w-full px-4 py-2.5 text-xs bg-input-custom border border-border-custom focus:border-indigo-500 rounded-xl outline-none transition text-foreground"
                                maxLength={13}
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={!manualBarcode.trim()}
                            className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow cursor-pointer flex items-center gap-1.5 shrink-0"
                        >
                            <Search className="w-3.5 h-3.5" />
                            <span>Έλεγχος</span>
                        </button>
                    </form>

                </div>
            </div>
        </div>
    );
}
