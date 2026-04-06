import React, { useState, useEffect, useCallback } from 'react';
import { Image as ImageIcon, Layers, Upload, Loader2, CheckCircle2, HelpCircle, Maximize2, Minimize2, Search, Code, X, ExternalLink, Wand2, Settings, Plus, Trash2, Moon, Sun, Globe, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { generateDesign, generateVisualPreview, editVisualPreview, generateMaterial, searchInspiration, ImageData, detectMaterialProperties, MaterialData } from './lib/gemini';
import { fileToBase64, urlToBase64, cn } from './lib/utils';
import { translations, Language } from './lib/i18n';
import localforage from 'localforage';
import { CropModal } from './components/CropModal';

const SCENE_SPACES = [
  {
    id: 'space1',
    name: 'Space 1',
    preview: '/spaces/space1/living.jpg',
    rooms: [
      { name: 'Living Room', url: '/spaces/space1/living.jpg' },
      { name: 'Bedroom', url: '/spaces/space1/bedroom.jpg' },
      { name: 'Kitchen', url: '/spaces/space1/kitchen.jpg' }
    ]
  },
  {
    id: 'space2',
    name: 'Space 2',
    preview: '/spaces/space2/living.jpg',
    rooms: [
      { name: 'Living Room', url: '/spaces/space2/living.jpg' },
      { name: 'Bedroom', url: '/spaces/space2/bedroom.jpg' },
      { name: 'Bathroom', url: '/spaces/space2/bathroom.jpg' }
    ]
  }
];

const MATERIAL_TEMPLATES = [
  { id: 'tile', name: 'Tile Pattern', url: '/materials/tile.jpg' },
  { id: 'wallpaper', name: 'Wallpaper', url: '/materials/wallpaper.jpg' },
  { id: 'wood', name: 'Wood Floor', url: '/materials/wood.jpg' },
  { id: 'concrete', name: 'Concrete', url: '/materials/concrete.jpg' },
];

type ActiveMaterial = {
  id: string;
  mode: 'template' | 'upload';
  url?: string;
  file?: File;
  preview: string;
  name: string;
  targetSurface: string;
  suitableSurfaces: string[];
};

export default function App() {
  const [lang, setLang] = useState<Language>('EN');
  const t = translations[lang];

  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [taskStatus, setTaskStatus] = useState({
    data: 'idle',
    visual: 'idle',
    search: 'idle'
  });
  const [error, setError] = useState<string | null>(null);
  
  // UI States
  const [outputTab, setOutputTab] = useState<'visual' | 'data' | 'search'>('visual');
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showAiMaterialModal, setShowAiMaterialModal] = useState(false);
  const [aiMaterialPrompt, setAiMaterialPrompt] = useState('');
  const [aiMaterialBaseImg, setAiMaterialBaseImg] = useState<File | null>(null);
  const [isGeneratingMaterial, setIsGeneratingMaterial] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Settings State
  const [enableDataTab, setEnableDataTab] = useState(false);
  const [enableSearchTab, setEnableSearchTab] = useState(false);

  // Scene States
  const [sceneMode, setSceneMode] = useState<'template' | 'upload'>('template');
  const [selectedSpace, setSelectedSpace] = useState<typeof SCENE_SPACES[0] | null>(null);
  const [uploadedScene, setUploadedScene] = useState<{file?: File, preview: string, name: string} | null>(null);
  const [customScenes, setCustomScenes] = useState<{id: string, name: string, preview: string}[]>([]);

  // Material States
  const [activeMaterials, setActiveMaterials] = useState<ActiveMaterial[]>([]);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [detectingMaterial, setDetectingMaterial] = useState(false);
  const [materialMode, setMaterialMode] = useState<'template' | 'upload'>('template');
  const [customMaterials, setCustomMaterials] = useState<{id: string, name: string, url: string}[]>([]);

  // Crop State
  const [cropState, setCropState] = useState<{
    isOpen: boolean;
    src: string;
    type: 'scene' | 'material';
    file: File;
    defaultName: string;
  } | null>(null);

  // Generation Progress
  const [generationProgress, setGenerationProgress] = useState<{
    percent: number;
    step: string;
  } | null>(null);

  // Load custom templates
  useEffect(() => {
    localforage.getItem('customScenes').then((val: any) => {
      if (val) setCustomScenes(val);
    });
    localforage.getItem('customMaterials').then((val: any) => {
      if (val) setCustomMaterials(val);
    });
  }, []);

  // Results State
  const [results, setResults] = useState<{
    data: any;
    visual: string[];
    search: { text: string; results: { title: string; pageUrl: string; imageUrl?: string }[] } | null;
  } | null>(null);

  const handleSceneUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        setCropState({
          isOpen: true,
          src: e.target?.result as string,
          type: 'scene',
          file,
          defaultName: file.name.split('.')[0]
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMaterialUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        setCropState({
          isOpen: true,
          src: e.target?.result as string,
          type: 'material',
          file,
          defaultName: file.name.split('.')[0]
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteCustomScene = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newScenes = customScenes.filter(s => s.id !== id);
    setCustomScenes(newScenes);
    localforage.setItem('customScenes', newScenes);
    if (uploadedScene?.name === customScenes.find(s => s.id === id)?.name) {
      setUploadedScene(null);
    }
  };

  const handleDeleteCustomMaterial = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newMaterials = customMaterials.filter(m => m.id !== id);
    setCustomMaterials(newMaterials);
    localforage.setItem('customMaterials', newMaterials);
  };

  const handleEditVisual = async () => {
    if (!editPrompt.trim() || !results?.visual || results.visual.length === 0) return;
    
    setIsEditing(true);
    const currentImgUrl = results.visual[currentImageIndex];
    const mimeType = currentImgUrl.split(';')[0].split(':')[1];
    const base64 = currentImgUrl.split(',')[1];
    
    try {
      const newVisual = await editVisualPreview({ base64, mimeType }, editPrompt);
      if (newVisual) {
        const newVisuals = [...results.visual];
        newVisuals[currentImageIndex] = newVisual;
        setResults({ ...results, visual: newVisuals });
        setEditPrompt('');
      } else {
        setError('Failed to edit visual.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to edit visual.');
    } finally {
      setIsEditing(false);
    }
  };

  const handleGenerateMaterial = async () => {
    if (!aiMaterialPrompt.trim()) return;
    
    setIsGeneratingMaterial(true);
    try {
      let baseImgData: ImageData | undefined;
      if (aiMaterialBaseImg) {
        const base64 = await fileToBase64(aiMaterialBaseImg);
        baseImgData = { base64, mimeType: aiMaterialBaseImg.type };
      }
      
      const newMaterialUrl = await generateMaterial(aiMaterialPrompt, baseImgData);
      if (newMaterialUrl) {
        const newMaterial = { 
          id: Math.random().toString(), 
          name: aiMaterialPrompt.substring(0, 20) + '...', 
          url: newMaterialUrl 
        };
        const newMaterials = [...customMaterials, newMaterial];
        setCustomMaterials(newMaterials);
        localforage.setItem('customMaterials', newMaterials);
        setShowAiMaterialModal(false);
        setAiMaterialPrompt('');
        setAiMaterialBaseImg(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingMaterial(false);
    }
  };
  const handleCropComplete = async (croppedBase64: string, name: string) => {
    if (!cropState) return;

    if (cropState.type === 'scene') {
      const newScene = { id: Math.random().toString(), name, preview: croppedBase64 };
      const newScenes = [...customScenes, newScene];
      setCustomScenes(newScenes);
      localforage.setItem('customScenes', newScenes);
      setUploadedScene(newScene);
      setSceneMode('upload');
    } else if (cropState.type === 'material') {
      const newMaterial = { id: Math.random().toString(), name, url: croppedBase64 };
      const newMaterials = [...customMaterials, newMaterial];
      setCustomMaterials(newMaterials);
      localforage.setItem('customMaterials', newMaterials);
      
      // Auto-add to active materials
      setDetectingMaterial(true);
      try {
        const imgData = { base64: croppedBase64.split(',')[1], mimeType: 'image/jpeg' };
        const detection = await detectMaterialProperties(imgData);
        setActiveMaterials(prev => [...prev, {
          id: Math.random().toString(),
          mode: 'template', // Treat custom as template now
          url: croppedBase64,
          preview: croppedBase64,
          name: name,
          targetSurface: detection.suitable_surfaces?.[0] || 'Wall',
          suitableSurfaces: detection.suitable_surfaces || ['Wall', 'Floor', 'Ceiling']
        }]);
      } catch (err) {
        console.error("Failed to process uploaded material:", err);
      }
      setDetectingMaterial(false);
      setIsAddingMaterial(false);
    }
    setCropState(null);
  };

  const addTemplateMaterial = (template: typeof MATERIAL_TEMPLATES[0]) => {
    setActiveMaterials(prev => [...prev, {
      id: Math.random().toString(),
      mode: 'template',
      url: template.url,
      preview: template.url,
      name: template.name,
      targetSurface: 'Wall',
      suitableSurfaces: ['Wall', 'Floor', 'Ceiling']
    }]);
    setIsAddingMaterial(false);
  };

  const removeMaterial = (id: string) => {
    setActiveMaterials(prev => prev.filter(m => m.id !== id));
  };

  const updateMaterialSurface = (id: string, surface: string) => {
    setActiveMaterials(prev => prev.map(m => m.id === id ? { ...m, targetSurface: surface } : m));
  };

  const handleSubmit = async () => {
    setIsGenerating(true);
    setError(null);
    setResults({ data: null, visual: [], search: null });
    setTaskStatus({ data: 'loading', visual: 'loading', search: 'loading' });
    setOutputTab('visual');
    setCurrentImageIndex(0);

    try {
      // 1. Gather Scene Images
      let roomsToProcess: { name: string, imgData: ImageData }[] = [];
      
      if (sceneMode === 'template' && selectedSpace) {
        for (const room of selectedSpace.rooms) {
          const imgData = await urlToBase64(room.url);
          roomsToProcess.push({ name: room.name, imgData });
        }
      } else if (sceneMode === 'upload' && uploadedScene) {
        if (uploadedScene.preview.startsWith('data:image')) {
          const mimeType = uploadedScene.preview.split(';')[0].split(':')[1];
          const base64 = uploadedScene.preview.split(',')[1];
          roomsToProcess.push({ name: uploadedScene.name, imgData: { base64, mimeType } });
        } else if (uploadedScene.file) {
          const base64 = await fileToBase64(uploadedScene.file);
          roomsToProcess.push({ name: uploadedScene.name, imgData: { base64, mimeType: uploadedScene.file.type } });
        }
      }

      if (roomsToProcess.length === 0) throw new Error('Please select or upload a scene.');

      // 2. Gather Material Images
      if (activeMaterials.length === 0) throw new Error('Please add at least one material.');
      
      const materialsData: MaterialData[] = [];
      for (const mat of activeMaterials) {
        let imgData: ImageData | null = null;
        if (mat.url && mat.url.startsWith('data:image')) {
          const mimeType = mat.url.split(';')[0].split(':')[1];
          const base64 = mat.url.split(',')[1];
          imgData = { base64, mimeType };
        } else if (mat.mode === 'template' && mat.url) {
          imgData = await urlToBase64(mat.url);
        } else if (mat.mode === 'upload' && mat.file) {
          const base64 = await fileToBase64(mat.file);
          imgData = { base64, mimeType: mat.file.type };
        } else if (mat.preview && mat.preview.startsWith('data:image')) {
          const mimeType = mat.preview.split(';')[0].split(':')[1];
          const base64 = mat.preview.split(',')[1];
          imgData = { base64, mimeType };
        }
        
        if (imgData) {
          materialsData.push({ img: imgData, surface: mat.targetSurface });
        }
      }

      // 3. Run AI Generation
      const prompt = `The user wants a 3D room design.
I have provided the Scene image followed by Material Texture images.
Apply these textures to their respective surfaces in the provided scene.
Provide a technical JSON schema that lists the materials, lighting, and mood board.`;

      const totalSteps = roomsToProcess.length + (enableDataTab ? 1 : 0) + (enableSearchTab ? 1 : 0);
      let currentStep = 0;

      // Generate visual for each room sequentially
      const generatedVisuals: string[] = [];
      for (let i = 0; i < roomsToProcess.length; i++) {
        const room = roomsToProcess[i];
        setGenerationProgress({ 
          percent: Math.round((currentStep / totalSteps) * 100), 
          step: `Generating visual for ${room.name} (${i + 1}/${roomsToProcess.length})...` 
        });
        
        try {
          const visual = await generateVisualPreview(room.imgData, materialsData);
          if (visual) generatedVisuals.push(visual);
        } catch (err) {
          console.error(`Failed to generate visual for ${room.name}`, err);
        }
        currentStep++;
      }

      if (generatedVisuals.length > 0) {
        setResults(prev => prev ? { ...prev, visual: generatedVisuals } : { data: null, visual: generatedVisuals, search: null });
        setTaskStatus(prev => ({ ...prev, visual: 'success' }));
      } else {
        setTaskStatus(prev => ({ ...prev, visual: 'error' }));
        throw new Error('Failed to generate any visuals.');
      }

      // Generate Data
      if (enableDataTab) {
        setGenerationProgress({ 
          percent: Math.round((currentStep / totalSteps) * 100), 
          step: `Extracting Engine Data...` 
        });
        try {
          const data = await generateDesign(prompt, roomsToProcess[0].imgData, materialsData);
          setResults(prev => prev ? { ...prev, data } : null);
          setTaskStatus(prev => ({ ...prev, data: 'success' }));
        } catch (err) {
          console.error(err);
          setTaskStatus(prev => ({ ...prev, data: 'error' }));
        }
        currentStep++;
      } else {
        setTaskStatus(prev => ({ ...prev, data: 'idle' }));
      }

      // Generate Search
      if (enableSearchTab) {
        setGenerationProgress({ 
          percent: Math.round((currentStep / totalSteps) * 100), 
          step: `Searching Web Inspiration...` 
        });
        try {
          const search = await searchInspiration(materialsData);
          setResults(prev => prev ? { ...prev, search } : null);
          setTaskStatus(prev => ({ ...prev, search: 'success' }));
        } catch (err) {
          console.error(err);
          setTaskStatus(prev => ({ ...prev, search: 'error' }));
        }
        currentStep++;
      } else {
        setTaskStatus(prev => ({ ...prev, search: 'idle' }));
      }

      setGenerationProgress({ percent: 100, step: 'Complete!' });
      setTimeout(() => setGenerationProgress(null), 1000);
      setIsGenerating(false);

    } catch (err: any) {
      setError(err.message || 'An error occurred during generation.');
      setResults(null);
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  };

  const handlePrevImage = useCallback(() => {
    if (results?.visual && results.visual.length > 0) {
      setCurrentImageIndex((prev) => (prev === 0 ? results.visual.length - 1 : prev - 1));
    }
  }, [results?.visual]);

  const handleNextImage = useCallback(() => {
    if (results?.visual && results.visual.length > 0) {
      setCurrentImageIndex((prev) => (prev === results.visual.length - 1 ? 0 : prev + 1));
    }
  }, [results?.visual]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevImage();
      if (e.key === 'ArrowRight') handleNextImage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevImage, handleNextImage]);

  const renderSceneSelection = () => {
    if (sceneMode === 'template' && selectedSpace) {
      return (
        <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
              <img src={selectedSpace.preview} alt={selectedSpace.name} className="w-full h-full object-cover" />
            </div>
            <span className="font-medium text-sm text-neutral-800 dark:text-neutral-200">{t[selectedSpace.id as keyof typeof t] || selectedSpace.name}</span>
          </div>
          <button onClick={() => setSelectedSpace(null)} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
            Change
          </button>
        </div>
      );
    }

    if (sceneMode === 'upload' && uploadedScene) {
      return (
        <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
              <img src={uploadedScene.preview} alt="Uploaded Scene" className="w-full h-full object-cover" />
            </div>
            <span className="font-medium text-sm text-neutral-800 dark:text-neutral-200 truncate max-w-[150px]">{uploadedScene.name}</span>
          </div>
          <button onClick={() => setUploadedScene(null)} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
            Change
          </button>
        </div>
      );
    }

    if (sceneMode === 'template') {
      return (
        <div className="grid grid-cols-2 gap-3">
          {SCENE_SPACES.map((space) => (
            <button
              key={space.id}
              onClick={() => setSelectedSpace(space)}
              className="group relative aspect-video rounded-xl overflow-hidden border-2 border-transparent hover:border-black dark:hover:border-white focus:border-black transition-all"
            >
              <img src={space.preview} alt={space.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent flex items-end p-3">
                <span className="text-white text-sm font-medium truncate">{t[space.id as keyof typeof t] || space.name}</span>
              </div>
            </button>
          ))}
          {customScenes.map((scene) => (
            <div key={scene.id} className="relative group aspect-video rounded-xl overflow-hidden border-2 border-transparent hover:border-black dark:hover:border-white focus-within:border-black transition-all">
              <button
                onClick={() => {
                  setUploadedScene({ preview: scene.preview, name: scene.name });
                  setSceneMode('upload');
                }}
                className="w-full h-full"
              >
                <img src={scene.preview} alt={scene.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent flex items-end p-3">
                  <span className="text-white text-sm font-medium truncate">{scene.name}</span>
                </div>
              </button>
              <button 
                onClick={(e) => handleDeleteCustomScene(scene.id, e)}
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      );
    }

    return (
      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl cursor-pointer bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <Upload className="w-6 h-6 mb-2 text-neutral-500 dark:text-neutral-400" />
          <p className="text-sm text-neutral-600 dark:text-neutral-300 font-medium">Click to upload scene</p>
          <p className="text-xs text-neutral-400 mt-1">JPG, PNG up to 5MB</p>
        </div>
        <input type="file" className="hidden" accept="image/*" onChange={handleSceneUpload} />
      </label>
    );
  };

  const renderMaterialSelection = () => {
    return (
      <div className="space-y-4">
        {/* Active Materials List */}
        {activeMaterials.length > 0 && (
          <div className="space-y-2">
            {activeMaterials.map((mat) => (
              <div key={mat.id} className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl">
                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                  <img src={mat.preview} alt={mat.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-neutral-800 dark:text-neutral-200 truncate">{mat.name}</p>
                  <select
                    value={mat.targetSurface}
                    onChange={(e) => updateMaterialSurface(mat.id, e.target.value)}
                    className="mt-1 block w-full text-xs rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                  >
                    {mat.suitableSurfaces.map(s => (
                      <option key={s} value={s}>{t[s.toLowerCase() as keyof typeof t] || s}</option>
                    ))}
                    {!mat.suitableSurfaces.includes('Wall') && <option value="Wall">{t.wall}</option>}
                    {!mat.suitableSurfaces.includes('Floor') && <option value="Floor">{t.floor}</option>}
                    {!mat.suitableSurfaces.includes('Ceiling') && <option value="Ceiling">{t.ceiling}</option>}
                    {!mat.suitableSurfaces.includes('Furniture') && <option value="Furniture">{t.furniture}</option>}
                  </select>
                </div>
                <button onClick={() => removeMaterial(mat.id)} className="p-2 text-neutral-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Material Section */}
        {(activeMaterials.length === 0 || isAddingMaterial) ? (
          <div className="space-y-4 border-t border-neutral-100 dark:border-neutral-800 pt-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{t.addMaterial}</h3>
              {activeMaterials.length > 0 && (
                <button onClick={() => setIsAddingMaterial(false)} className="text-xs text-neutral-500 hover:text-black dark:hover:text-white">Cancel</button>
              )}
            </div>
            
            <div className="flex gap-2 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
              <button
                onClick={() => setMaterialMode('template')}
                className={cn("flex-1 py-1 text-sm font-medium rounded-md transition-colors", materialMode === 'template' ? "bg-white dark:bg-neutral-700 shadow-sm text-black dark:text-white" : "text-neutral-500 hover:text-black dark:hover:text-white")}
              >
                {t.templates}
              </button>
              <button
                onClick={() => setMaterialMode('upload')}
                className={cn("flex-1 py-1 text-sm font-medium rounded-md transition-colors", materialMode === 'upload' ? "bg-white dark:bg-neutral-700 shadow-sm text-black dark:text-white" : "text-neutral-500 hover:text-black dark:hover:text-white")}
              >
                {t.customUpload}
              </button>
            </div>

            {materialMode === 'template' ? (
              <div className="grid grid-cols-4 gap-2">
                {MATERIAL_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => addTemplateMaterial(template)}
                    className="group relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-black dark:hover:border-white focus:border-black transition-all"
                  >
                    <img src={template.url} alt={template.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-6 h-6 text-white" />
                    </div>
                  </button>
                ))}
                {customMaterials.map((template) => (
                  <div key={template.id} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-black dark:hover:border-white focus-within:border-black transition-all">
                    <button
                      onClick={() => addTemplateMaterial(template)}
                      className="w-full h-full"
                    >
                      <img src={template.url} alt={template.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="w-6 h-6 text-white" />
                      </div>
                    </button>
                    <button 
                      onClick={(e) => handleDeleteCustomMaterial(template.id, e)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl cursor-pointer bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors relative overflow-hidden">
                {detectingMaterial ? (
                  <div className="flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 mb-2 text-black dark:text-white animate-spin" />
                    <p className="text-sm text-neutral-600 dark:text-neutral-300 font-medium">Analyzing Material...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-6 h-6 mb-2 text-neutral-500 dark:text-neutral-400" />
                    <p className="text-sm text-neutral-600 dark:text-neutral-300 font-medium">Upload materials</p>
                    <p className="text-xs text-neutral-400 mt-1">Select multiple files</p>
                  </div>
                )}
                <input type="file" multiple className="hidden" accept="image/*" onChange={handleMaterialUpload} disabled={detectingMaterial} />
              </label>
            )}
          </div>
        ) : (
          <button
            onClick={() => setIsAddingMaterial(true)}
            className="w-full py-3 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t.addMaterial}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] font-sans text-slate-900 dark:text-slate-100 flex flex-col h-screen overflow-hidden transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-[#1E293B] px-6 py-4 flex items-center justify-between shrink-0 z-10 transition-colors">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 dark:bg-cyan-600 text-white p-2 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{t.appTitle}</h1>
            <p className="text-xs text-slate-500 dark:text-cyan-400 font-medium tracking-wide uppercase">AI Interior Architect</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <button className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-[#1E293B] rounded-full transition-colors flex items-center gap-1">
              <Globe className="w-5 h-5" />
              <span className="text-xs font-bold">{lang}</span>
            </button>
            <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
              <button onClick={() => setLang('EN')} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-[#1E293B] dark:text-slate-200">🇺🇸 EN</button>
              <button onClick={() => setLang('MM')} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-[#1E293B] dark:text-slate-200">🇲🇲 MM</button>
              <button onClick={() => setLang('TW')} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-[#1E293B] dark:text-slate-200">🇹🇼 TW</button>
            </div>
          </div>
          <button 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-[#1E293B] rounded-full transition-colors"
            title={theme === 'light' ? t.themeDark : t.themeLight}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-[#1E293B] rounded-full transition-colors"
            title={t.settings}
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowHelp(true)}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-[#1E293B] rounded-full transition-colors"
            title={t.help}
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto flex flex-row gap-4 p-4 min-h-0 overflow-hidden relative">
        
        {/* Left Column: Inputs (Sidebar) */}
        <div className={cn(
          "flex flex-col gap-4 overflow-y-auto pr-2 pb-2 transition-all duration-300 ease-in-out shrink-0",
          isSidebarOpen ? "w-80 lg:w-96 opacity-100" : "w-0 opacity-0 overflow-hidden pr-0"
        )}>
          
          {/* Step 1: Scene */}
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-[#1E293B] space-y-4 shrink-0 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-slate-900 dark:bg-cyan-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">1</div>
              <h2 className="text-base font-semibold dark:text-slate-100">{t.uploadScene}</h2>
            </div>
            
            {!( (sceneMode === 'template' && selectedSpace) || (sceneMode === 'upload' && uploadedScene) ) && (
              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-[#1E293B] rounded-lg">
                <button
                  onClick={() => setSceneMode('template')}
                  className={cn("flex-1 py-1 text-sm font-medium rounded-md transition-colors", sceneMode === 'template' ? "bg-white dark:bg-cyan-600 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white")}
                >
                  {t.templates}
                </button>
                <button
                  onClick={() => setSceneMode('upload')}
                  className={cn("flex-1 py-1 text-sm font-medium rounded-md transition-colors", sceneMode === 'upload' ? "bg-white dark:bg-cyan-600 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white")}
                >
                  {t.customUpload}
                </button>
              </div>
            )}

            {renderSceneSelection()}
          </div>

          {/* Step 2: Material */}
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-[#1E293B] space-y-4 shrink-0 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="bg-slate-900 dark:bg-cyan-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">2</div>
                <h2 className="text-base font-semibold dark:text-slate-100">{t.materials}</h2>
              </div>
              <button 
                onClick={() => setShowAiMaterialModal(true)}
                className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 text-slate-700 dark:bg-[#1E293B] dark:text-cyan-400 px-2.5 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#334155] transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                AI Generate
              </button>
            </div>

            {renderMaterialSelection()}
          </div>

          <button
            onClick={handleSubmit}
            disabled={
              isGenerating || 
              (sceneMode === 'template' && !selectedSpace) ||
              (sceneMode === 'upload' && !uploadedScene) ||
              activeMaterials.length === 0
            }
            className="w-full bg-slate-900 dark:bg-amber-500 text-white dark:text-[#0B1120] rounded-xl py-3 font-bold text-base hover:bg-slate-800 dark:hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shrink-0 mt-2 relative overflow-hidden"
          >
            {isGenerating && generationProgress ? (
              <>
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-slate-800 dark:bg-amber-600 transition-all duration-300 ease-out opacity-20"
                  style={{ width: `${generationProgress.percent}%` }}
                />
                <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                <span className="relative z-10">{generationProgress.percent}% - {generationProgress.step}</span>
              </>
            ) : isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t.generating}
              </>
            ) : (
              t.generateDesign
            )}
          </button>
        </div>

        {/* Right Column: Output Tabs */}
        <div className="flex-1 flex flex-col min-w-0 relative h-full">
          {/* Sidebar Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute -left-4 top-1/2 -translate-y-1/2 z-20 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] p-1.5 rounded-r-md shadow-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-amber-400 transition-colors"
            title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          <div className="bg-white dark:bg-[#0F172A] rounded-2xl shadow-sm border border-black dark:border-[#1E293B] flex flex-col h-full overflow-hidden transition-colors ml-2">
            
            {/* Output Tabs Header */}
            <div className="flex border-b border-slate-200 dark:border-[#1E293B] bg-slate-50 dark:bg-[#0B1120] shrink-0">
              <button
                onClick={() => setOutputTab('visual')}
                className={cn("flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors", outputTab === 'visual' ? "bg-white dark:bg-[#0F172A] text-slate-900 dark:text-cyan-400 border-b-2 border-slate-900 dark:border-cyan-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E293B]")}
              >
                <ImageIcon className="w-4 h-4" />
                {t.visuals3D}
              </button>
              {enableDataTab && (
                <button
                  onClick={() => setOutputTab('data')}
                  className={cn("flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors", outputTab === 'data' ? "bg-white dark:bg-[#0F172A] text-slate-900 dark:text-cyan-400 border-b-2 border-slate-900 dark:border-cyan-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E293B]")}
                >
                  <Code className="w-4 h-4" />
                  {t.engineData}
                </button>
              )}
              {enableSearchTab && (
                <button
                  onClick={() => setOutputTab('search')}
                  className={cn("flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors", outputTab === 'search' ? "bg-white dark:bg-[#0F172A] text-slate-900 dark:text-cyan-400 border-b-2 border-slate-900 dark:border-cyan-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E293B]")}
                >
                  <Search className="w-4 h-4" />
                  {t.webInspiration}
                </button>
              )}
            </div>

            {/* Output Content */}
            <div className="flex-1 p-4 flex flex-col relative overflow-hidden">
              {error ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
                    <X className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">{t.error}</h3>
                  <p className="text-red-600 max-w-md bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-900/50">{error}</p>
                </div>
              ) : !results && !isGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-[#1E293B] rounded-xl p-8 text-center bg-slate-50/50 dark:bg-[#0B1120]/50">
                  <Wand2 className="w-12 h-12 mb-4 opacity-20" />
                  <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">Ready to Generate</h3>
                  <p className="max-w-sm text-sm">{t.noVisuals}</p>
                </div>
              ) : (
                <>
                  {/* Visual Tab */}
                  {outputTab === 'visual' && (
                    <div className="flex-1 flex flex-col min-h-0">
                      {taskStatus.visual === 'loading' ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                          <Loader2 className="w-8 h-8 animate-spin text-slate-900 dark:text-cyan-400" />
                          <p className="text-slate-500 dark:text-slate-400 font-medium">{t.generating}</p>
                        </div>
                      ) : taskStatus.visual === 'error' || !results?.visual || results.visual.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-slate-500 bg-slate-100 dark:bg-[#0B1120] rounded-xl border border-slate-200 dark:border-[#1E293B]">
                          {t.error}
                        </div>
                      ) : (
                        <div className="flex flex-col h-full relative">
                          <div className="relative group flex-1 bg-slate-100 dark:bg-[#0B1120] rounded-xl overflow-hidden border border-slate-200 dark:border-[#1E293B] flex items-center justify-center min-h-0">
                            <img src={results.visual[currentImageIndex]} alt="Generated 3D Visual" className="max-w-full max-h-full object-contain" />
                            
                            {results.visual.length > 1 && (
                              <>
                                <button 
                                  onClick={handlePrevImage}
                                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black text-white p-2 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <ChevronLeft className="w-6 h-6" />
                                </button>
                                <button 
                                  onClick={handleNextImage}
                                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black text-white p-2 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <ChevronRight className="w-6 h-6" />
                                </button>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                                  {currentImageIndex + 1} / {results.visual.length}
                                </div>
                              </>
                            )}

                            <button 
                              onClick={() => setIsFullscreen(true)}
                              className="absolute top-4 right-4 bg-black/50 hover:bg-black text-white p-2 rounded-lg backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Maximize2 className="w-5 h-5" />
                            </button>
                          </div>
                          
                          {/* Edit Prompt Input */}
                          <div className="mt-3 flex gap-2 shrink-0">
                            <input
                              type="text"
                              value={editPrompt}
                              onChange={(e) => setEditPrompt(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleEditVisual()}
                              placeholder="Ask AI designer to change something (e.g., 'Add a red sofa')"
                              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-[#1E293B] bg-white dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-cyan-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                              disabled={isEditing}
                            />
                            <button
                              onClick={handleEditVisual}
                              disabled={isEditing || !editPrompt.trim()}
                              className="px-4 py-2.5 bg-slate-900 dark:bg-cyan-600 text-white rounded-xl font-medium hover:bg-slate-800 dark:hover:bg-cyan-500 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[60px]"
                            >
                              {isEditing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Data Tab */}
                  {outputTab === 'data' && enableDataTab && (
                    <div className="flex-1 flex flex-col min-h-0">
                      {taskStatus.data === 'loading' ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                          <Loader2 className="w-8 h-8 animate-spin text-slate-900 dark:text-cyan-400" />
                          <p className="text-slate-500 dark:text-slate-400 font-medium">{t.processing}</p>
                        </div>
                      ) : taskStatus.data === 'error' || !results?.data ? (
                        <div className="flex-1 flex items-center justify-center text-slate-500 bg-slate-100 dark:bg-[#0B1120] rounded-xl border border-slate-200 dark:border-[#1E293B]">
                          {t.error}
                        </div>
                      ) : (
                        <div className="flex-1 overflow-auto bg-slate-900 rounded-xl p-4">
                          <pre className="text-sm font-mono text-cyan-400 whitespace-pre-wrap">
                            {JSON.stringify(results.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Search Tab */}
                  {outputTab === 'search' && enableSearchTab && (
                    <div className="flex-1 flex flex-col min-h-0">
                      {taskStatus.search === 'loading' ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                          <Loader2 className="w-8 h-8 animate-spin text-slate-900 dark:text-cyan-400" />
                          <p className="text-slate-500 dark:text-slate-400 font-medium">{t.processing}</p>
                        </div>
                      ) : taskStatus.search === 'error' || !results?.search ? (
                        <div className="flex-1 flex items-center justify-center text-slate-500 bg-slate-100 dark:bg-[#0B1120] rounded-xl border border-slate-200 dark:border-[#1E293B]">
                          {t.error}
                        </div>
                      ) : (
                        <div className="flex-1 overflow-auto space-y-6 pr-2">
                          <div className="prose prose-sm max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {results.search.text}
                          </div>
                          
                          {results.search.results && results.search.results.length > 0 && (
                            <div className="space-y-4">
                              <h4 className="font-semibold text-lg flex items-center gap-2 dark:text-slate-100">
                                <Search className="w-5 h-5 text-slate-500 dark:text-cyan-400" />
                                Inspiration Gallery
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {results.search.results.map((item, i) => (
                                  <a 
                                    key={i} 
                                    href={item.pageUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="group flex flex-col bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-xl overflow-hidden hover:border-slate-400 dark:hover:border-cyan-500 transition-colors shadow-sm"
                                  >
                                    {item.imageUrl ? (
                                      <div className="aspect-video w-full overflow-hidden bg-slate-100 dark:bg-[#0B1120]">
                                        <img 
                                          src={item.imageUrl} 
                                          alt={item.title} 
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            (e.target as HTMLImageElement).parentElement!.classList.add('flex', 'items-center', 'justify-center');
                                            (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300 dark:text-slate-600"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <div className="aspect-video w-full bg-slate-100 dark:bg-[#0B1120] flex items-center justify-center">
                                        <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                      </div>
                                    )}
                                    <div className="p-3 flex flex-col flex-1">
                                      <h5 className="font-medium text-sm text-slate-900 dark:text-slate-100 line-clamp-2 mb-1">{item.title}</h5>
                                      <p className="text-xs text-slate-500 dark:text-cyan-400 mt-auto truncate flex items-center gap-1">
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                        {new URL(item.pageUrl).hostname}
                                      </p>
                                    </div>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Settings className="w-5 h-5" />
                {t.settings}
              </h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-neutral-900 dark:text-neutral-100">{t.engineData}</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Show the raw JSON data extracted by the AI.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={enableDataTab} onChange={(e) => {
                    setEnableDataTab(e.target.checked);
                    if (!e.target.checked && outputTab === 'data') setOutputTab('visual');
                  }} />
                  <div className="w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-white"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-neutral-900 dark:text-neutral-100">{t.webInspiration}</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Show AI web search results for the materials.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={enableSearchTab} onChange={(e) => {
                    setEnableSearchTab(e.target.checked);
                    if (!e.target.checked && outputTab === 'search') setOutputTab('visual');
                  }} />
                  <div className="w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-white"></div>
                </label>
              </div>
            </div>

            <button 
              onClick={() => setShowSettings(false)}
              className="w-full mt-8 bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                {t.help}
              </h2>
              <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 text-sm text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap">
              {t.helpText}
            </div>
            <button 
              onClick={() => setShowHelp(false)}
              className="w-full mt-6 bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Image Modal */}
      {isFullscreen && results?.visual && results.visual.length > 0 && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
          <button 
            onClick={() => setIsFullscreen(false)}
            className="absolute top-6 right-6 text-white/70 hover:text-white p-2 transition-colors z-50"
          >
            <Minimize2 className="w-8 h-8" />
          </button>
          
          {results.visual.length > 1 && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
                className="absolute left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-4 transition-colors z-50"
              >
                <ChevronLeft className="w-12 h-12" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
                className="absolute right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-4 transition-colors z-50"
              >
                <ChevronRight className="w-12 h-12" />
              </button>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-lg font-medium tracking-widest z-50">
                {currentImageIndex + 1} / {results.visual.length}
              </div>
            </>
          )}

          <img src={results.visual[currentImageIndex]} alt="Generated 3D Visual Fullscreen" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {/* Crop Modal */}
      {cropState && (
        <CropModal
          src={cropState.src}
          defaultName={cropState.defaultName}
          onComplete={handleCropComplete}
          onCancel={() => setCropState(null)}
        />
      )}

      {/* AI Material Generation Modal */}
      {showAiMaterialModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-md w-full p-6 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Wand2 className="w-5 h-5" />
                Generate Material
              </h2>
              <button onClick={() => setShowAiMaterialModal(false)} className="p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Prompt
                </label>
                <textarea
                  value={aiMaterialPrompt}
                  onChange={(e) => setAiMaterialPrompt(e.target.value)}
                  placeholder="e.g., A seamless geometric marble pattern with gold veins"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white focus:outline-none resize-none h-24"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Base Image (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAiMaterialBaseImg(e.target.files?.[0] || null)}
                  className="w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 dark:file:bg-neutral-800 dark:file:text-neutral-300"
                />
              </div>

              <button
                onClick={handleGenerateMaterial}
                disabled={isGeneratingMaterial || !aiMaterialPrompt.trim()}
                className="w-full py-3 rounded-xl font-medium text-white bg-black dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGeneratingMaterial ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                Generate & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
