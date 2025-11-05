import React, { useState, useEffect, ChangeEvent, useRef } from 'react';
import GamePlayer from './components/GamePlayer';
import SceneTree from './components/SceneTree';
import { VisualNovel, Character, Scene, Choice, DialogueLine, Expression } from './types';
import { generateStory, generateSceneBackground, generateSceneDialogue } from './services/geminiService';
import { convertToRenpyScript, exportVnToJson } from './utils/exportUtils';
import { EditIcon, PlayIcon, PlusIcon, TrashIcon, SparklesIcon, SaveIcon, ResetIcon, DownloadIcon, UploadIcon } from './components/icons';

const DEMO_VN: VisualNovel = {
  title: "A Dragon's Quest",
  startSceneId: "scene_1",
  characters: [
    { 
      id: "char_hero", 
      name: "Valiant Knight", 
      defaultExpressionId: "expr_hero_1",
      expressions: [
        { id: "expr_hero_1", name: "Default", imageUrl: "https://picsum.photos/seed/vn-hero-neutral/400/600" },
        { id: "expr_hero_2", name: "Determined", imageUrl: "https://picsum.photos/seed/vn-hero-determined/400/600" },
        { id: "expr_hero_3", name: "Confused", imageUrl: "https://picsum.photos/seed/vn-hero-confused/400/600" },
      ]
    },
    { 
      id: "char_dragon", 
      name: "Sparky the Dragon", 
      defaultExpressionId: "expr_dragon_1",
      expressions: [
        { id: "expr_dragon_1", name: "Default", imageUrl: "https://picsum.photos/seed/vn-dragon-neutral/400/600" },
        { id: "expr_dragon_2", name: "Happy", imageUrl: "https://picsum.photos/seed/vn-dragon-happy/400/600" },
        { id: "expr_dragon_3", name: "Playful", imageUrl: "https://picsum.photos/seed/vn-dragon-playful/400/600" },
      ]
    },
  ],
  scenes: [
    {
      id: "scene_1",
      name: "Cave Entrance",
      backgroundUrl: "https://picsum.photos/seed/vn-cave/1280/720",
      presentCharacterIds: [],
      dialogue: [{ characterId: null, text: "You stand before a dark, ominous cave. A worn sign reads, 'Dragon territory!' What do you do?", expressionId: null }],
      choices: [
        { text: "Bravely enter the cave.", nextSceneId: "scene_2" },
        { text: "Decide this is a bad idea and go home.", nextSceneId: "scene_4" },
      ],
      aiPrompt: "A hero stands at the dark, ominous entrance to a dragon's cave. A worn warning sign is posted nearby.",
    },
    {
      id: "scene_2",
      name: "Inside the Cave",
      backgroundUrl: "https://picsum.photos/seed/vn-inside-cave/1280/720",
      presentCharacterIds: ["char_hero", "char_dragon"],
      dialogue: [
        { characterId: "char_dragon", expressionId: "expr_dragon_2", text: "A tiny, shimmering dragon looks up at you. 'Hi! I'm Sparky! Are you here to play?' it squeaks." },
        { characterId: "char_hero", expressionId: "expr_hero_2", text: "A dragon...? I am the Valiant Knight. I have come to test my... might!" },
        { characterId: "char_dragon", expressionId: "expr_dragon_1", text: "Ooh, a game! What are we playing?" },
      ],
      choices: [
        { text: "Challenge it to a duel!", nextSceneId: "scene_3a" },
        { text: "Ask if it has any board games.", nextSceneId: "scene_3b" },
      ],
      aiPrompt: "Inside a treasure-filled cave, the Valiant Knight confronts Sparky, a small, friendly, shimmering dragon.",
    },
    {
      id: "scene_3a",
      name: "The 'Duel'",
      backgroundUrl: "https://picsum.photos/seed/vn-inside-cave/1280/720",
      presentCharacterIds: ["char_dragon", "char_hero"],
      dialogue: [
        { characterId: "char_dragon", expressionId: "expr_dragon_3", text: "Sparky giggles and blows a single, harmless soap bubble at you. 'You win!' it chirps." },
        { characterId: "char_hero", expressionId: "expr_hero_3", text: "..." },
        { characterId: null, expressionId: null, text: "You feel slightly foolish." }
      ],
      choices: [],
      aiPrompt: "The tiny dragon playfully blows a single, harmless soap bubble at the knight inside the cave.",
    },
    {
      id: "scene_3b",
      name: "Game Night",
      backgroundUrl: "https://picsum.photos/seed/vn-games/1280/720",
      presentCharacterIds: ["char_hero", "char_dragon"],
      dialogue: [
        { characterId: null, expressionId: null, text: "You spend the afternoon playing a game of 'Castles & Catapults' with Sparky." },
        { characterId: "char_hero", expressionId: "expr_hero_1", text: "This is the most fun I've had all year." },
      ],
      choices: [],
       aiPrompt: "The knight and the small dragon happily play a board game together, surrounded by treasure.",
    },
     {
      id: "scene_4",
      name: "Safe and Sound",
      backgroundUrl: "https://picsum.photos/seed/vn-home/1280/720",
      presentCharacterIds: [],
      dialogue: [{ characterId: null, expressionId: null, text: "You return home, safe and sound. The world remains un-adventured, but at least you weren't dragon food." }],
      choices: [],
       aiPrompt: "A cozy, peaceful village path leading home at sunset.",
    },
  ],
};

const LOCAL_STORAGE_KEY = 'visual-novel-creator-data';

const App: React.FC = () => {
  const [vn, setVn] = useState<VisualNovel>(DEMO_VN);
  const [mode, setMode] = useState<'edit' | 'play'>('edit');
  const [currentSceneId, setCurrentSceneId] = useState<string>(vn.startSceneId);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(vn.startSceneId);
  const [aiTheme, setAiTheme] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);
  const [isGeneratingDialogue, setIsGeneratingDialogue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setVn(parsedData);
        setSelectedSceneId(parsedData.startSceneId);
      } else {
        setVn(DEMO_VN);
        setSelectedSceneId(DEMO_VN.startSceneId);
      }
    } catch (e) {
      console.error("Failed to load data from local storage", e);
      setVn(DEMO_VN);
      setSelectedSceneId(DEMO_VN.startSceneId);
    }
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(vn));
      alert('Project saved to browser successfully!');
    } catch (e) {
      console.error("Failed to save data", e);
      alert('Error: Could not save project.');
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all data to the demo version? This action cannot be undone.')) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      window.location.reload();
    }
  };

  const handleExportToRenpy = () => {
    const script = convertToRenpyScript(vn);
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'script.rpy';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert(`'script.rpy' has been downloaded.\n\nIMPORTANT: This script references image filenames but does not include the images themselves. You must manually save each character and background image, then place them in the 'game/images' folder of your Ren'Py project, ensuring the filenames match exactly what's defined in the script (e.g., 'char_CharacterName_ExpressionName.png', 'bg_SceneName.png').`);
  };

  const handleExportToJson = () => {
    exportVnToJson(vn);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== 'string') {
          throw new Error("Could not read file.");
        }
        const importedData = JSON.parse(text);
        
        if (importedData.title && Array.isArray(importedData.scenes) && Array.isArray(importedData.characters) && importedData.startSceneId) {
          if (window.confirm('Overwrite current project and load new project? Unsaved changes will be lost.')) {
            setVn(importedData as VisualNovel);
            setSelectedSceneId(importedData.startSceneId);
            setCurrentSceneId(importedData.startSceneId);
            alert('Project loaded successfully!');
          }
        } else {
          throw new Error("Invalid file format. Please ensure it's a valid Visual Novel JSON file.");
        }
      } catch (err) {
        console.error("Error importing JSON file:", err);
        alert(err instanceof Error ? err.message : "An error occurred while importing the JSON file.");
      } finally {
        if (e.target) {
          e.target.value = '';
        }
      }
    };
    reader.onerror = () => {
       alert("An error occurred while reading the file.");
    };
    reader.readAsText(file);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const updateVn = (updater: (draft: VisualNovel) => VisualNovel) => {
    setVn(prevVn => updater(JSON.parse(JSON.stringify(prevVn))));
  };
  
  const handleGenerateStory = async () => {
    if (!aiTheme.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const newVn = await generateStory(aiTheme);
      setVn(newVn);
      setSelectedSceneId(newVn.startSceneId);
      setAiTheme('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Character Handlers
  const handleAddCharacter = () => {
    const newId = `char_${Date.now()}`;
    const newExprId = `expr_${Date.now()}`;
    const newCharacter: Character = { 
      id: newId, 
      name: 'New Character', 
      expressions: [{ id: newExprId, name: 'Default', imageUrl: '' }],
      defaultExpressionId: newExprId
    };
    updateVn(draft => ({ ...draft, characters: [...draft.characters, newCharacter] }));
  };

  const handleCharacterChange = (id: string, field: 'name', value: string) => {
    updateVn(draft => ({
      ...draft,
      characters: draft.characters.map(c => c.id === id ? { ...c, [field]: value } : c),
    }));
  };

  const handleDeleteCharacter = (id: string) => {
    if (window.confirm('Are you sure you want to delete this character?')) {
      updateVn(draft => {
        draft.characters = draft.characters.filter(c => c.id !== id);
        draft.scenes.forEach(s => {
          s.presentCharacterIds = s.presentCharacterIds.filter(cid => cid !== id);
          s.dialogue.forEach(d => {
            if (d.characterId === id) d.characterId = null;
          });
        });
        return draft;
      });
    }
  };
  
  // Expression Handlers
  const handleAddExpression = (characterId: string) => {
    const newExpr: Expression = { id: `expr_${Date.now()}`, name: 'New Expression', imageUrl: '' };
    updateVn(draft => {
      const character = draft.characters.find(c => c.id === characterId);
      if (character) {
        character.expressions.push(newExpr);
      }
      return draft;
    });
  };

  const handleExpressionChange = (charId: string, exprId: string, field: keyof Omit<Expression, 'id'>, value: string) => {
    updateVn(draft => {
      const character = draft.characters.find(c => c.id === charId);
      if (character) {
        const expression = character.expressions.find(e => e.id === exprId);
        if (expression) {
          (expression as any)[field] = value;
        }
      }
      return draft;
    });
  };
  
  const handleExpressionImageUpload = async (e: ChangeEvent<HTMLInputElement>, charId: string, exprId: string) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      handleExpressionChange(charId, exprId, 'imageUrl', base64);
    }
  };

  const handleDeleteExpression = (charId: string, exprId: string) => {
    updateVn(draft => {
      const character = draft.characters.find(c => c.id === charId);
      if (character && character.expressions.length > 1) {
        character.expressions = character.expressions.filter(e => e.id !== exprId);
        if (character.defaultExpressionId === exprId) {
          character.defaultExpressionId = character.expressions[0]?.id || null;
        }
      } else {
        alert("A character must have at least one expression.");
      }
      return draft;
    });
  };

  const handleSetDefaultExpression = (charId: string, exprId: string) => {
    updateVn(draft => {
      const character = draft.characters.find(c => c.id === charId);
      if (character) {
        character.defaultExpressionId = exprId;
      }
      return draft;
    });
  };

  // Scene Handlers
  const handleAddScene = () => {
    const newId = `scene_${Date.now()}`;
    const newScene: Scene = { id: newId, name: 'New Scene', backgroundUrl: '', presentCharacterIds: [], dialogue: [{ characterId: null, text: 'New dialogue...', expressionId: null }], choices: [], aiPrompt: '' };
    updateVn(draft => ({ ...draft, scenes: [...draft.scenes, newScene] }));
    setSelectedSceneId(newId);
  };

  const handleDeleteScene = (id: string) => {
     if (id === vn.startSceneId) {
      alert("The start scene cannot be deleted.");
      return;
    }
    if (window.confirm('Are you sure you want to delete this scene?')) {
      updateVn(draft => {
        draft.scenes = draft.scenes.filter(s => s.id !== id);
        draft.scenes.forEach(s => {
          s.choices = s.choices.filter(c => c.nextSceneId !== id);
        });
        if (selectedSceneId === id) {
          setSelectedSceneId(draft.startSceneId);
        }
        return draft;
      });
    }
  };

  const handleSceneChange = (id: string, field: 'name' | 'backgroundUrl' | 'aiPrompt', value: string) => {
    updateVn(draft => ({
      ...draft,
      scenes: draft.scenes.map(s => s.id === id ? { ...s, [field]: value } : s),
    }));
  };
  
  const handleSceneBgUpload = async (e: ChangeEvent<HTMLInputElement>, id: string) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      handleSceneChange(id, 'backgroundUrl', base64);
    }
  };

  const handlePresentCharacterToggle = (sceneId: string, characterId: string, isPresent: boolean) => {
    updateVn(draft => {
        const scene = draft.scenes.find(s => s.id === sceneId);
        if (scene) {
            if (isPresent) {
                scene.presentCharacterIds.push(characterId);
            } else {
                scene.presentCharacterIds = scene.presentCharacterIds.filter(id => id !== characterId);
                scene.dialogue.forEach(line => {
                    if (line.characterId === characterId) {
                        line.characterId = null;
                        line.expressionId = null;
                    }
                });
            }
        }
        return draft;
    });
  };
  
  // Dialogue & Choice Handlers
  const handleAddDialogueLine = (sceneId: string) => {
    updateVn(draft => {
      const scene = draft.scenes.find(s => s.id === sceneId);
      if (scene) {
        scene.dialogue.push({ characterId: null, text: '', expressionId: null });
      }
      return draft;
    });
  };

  const handleDialogueLineChange = (sceneId: string, lineIndex: number, field: keyof DialogueLine, value: string | null) => {
    updateVn(draft => {
        const scene = draft.scenes.find(s => s.id === sceneId);
        if (scene) {
            (scene.dialogue[lineIndex] as any)[field] = value;
             if (field === 'characterId' && !value) {
                scene.dialogue[lineIndex].expressionId = null;
            }
        }
        return draft;
    });
  };
  
  const handleDeleteDialogueLine = (sceneId: string, lineIndex: number) => {
     updateVn(draft => {
        const scene = draft.scenes.find(s => s.id === sceneId);
        if (scene) {
            if (scene.dialogue.length > 1) {
              scene.dialogue.splice(lineIndex, 1);
            } else {
              alert("A scene must have at least one line of dialogue.");
            }
        }
        return draft;
    });
  };
  
  const handleAddChoice = (sceneId: string) => {
    const firstOtherScene = vn.scenes.find(s => s.id !== sceneId);
    if (!firstOtherScene) {
      alert("Create another scene first to link a choice to it!");
      return;
    }
    const newChoice: Choice = { text: 'New Choice', nextSceneId: firstOtherScene.id };
    updateVn(draft => ({
      ...draft,
      scenes: draft.scenes.map(s => s.id === sceneId ? { ...s, choices: [...s.choices, newChoice] } : s),
    }));
  };

  const handleChoiceChange = (sceneId: string, choiceIndex: number, field: keyof Choice, value: string) => {
    updateVn(draft => ({
      ...draft,
      scenes: draft.scenes.map(s => {
        if (s.id === sceneId) {
          s.choices[choiceIndex] = { ...s.choices[choiceIndex], [field]: value };
        }
        return s;
      }),
    }));
  };

  const handleDeleteChoice = (sceneId: string, choiceIndex: number) => {
    updateVn(draft => ({
      ...draft,
      scenes: draft.scenes.map(s => {
        if (s.id === sceneId) {
          s.choices.splice(choiceIndex, 1);
        }
        return s;
      }),
    }));
  };
  
  // AI Handlers
  const selectedScene = vn.scenes.find(s => s.id === selectedSceneId);
  const handlePlayerChoice = (nextSceneId: string) => setCurrentSceneId(nextSceneId);

    const handleGenerateBg = async () => {
        if (!selectedScene || !selectedScene.aiPrompt?.trim()) return;
        setIsGeneratingBg(true);
        setError(null);
        try {
            const newImageUrl = await generateSceneBackground(selectedScene.aiPrompt);
            handleSceneChange(selectedScene.id, 'backgroundUrl', newImageUrl);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate background.');
        } finally {
            setIsGeneratingBg(false);
        }
    };

    const handleGenerateDialogue = async () => {
        if (!selectedScene || !selectedScene.aiPrompt?.trim()) return;
        const presentCharacters = vn.characters.filter(c => selectedScene.presentCharacterIds.includes(c.id));
        setIsGeneratingDialogue(true);
        setError(null);
        try {
            const newDialogue = await generateSceneDialogue(selectedScene.name, selectedScene.aiPrompt, presentCharacters);
            updateVn(draft => {
                const scene = draft.scenes.find(s => s.id === selectedScene.id);
                if (scene) {
                    scene.dialogue = newDialogue.map(d => ({...d, expressionId: null}));
                }
                return draft;
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate dialogue.');
        } finally {
            setIsGeneratingDialogue(false);
        }
    };

  if (mode === 'play') {
    return (
      <div className="w-screen h-screen bg-black">
        <GamePlayer vn={vn} currentSceneId={currentSceneId} onChoice={handlePlayerChoice} />
        <button
          onClick={() => setMode('edit')}
          className="absolute top-4 right-4 z-50 flex items-center p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors"
          title="Return to Editor"
        >
          <EditIcon className="w-6 h-6" />
        </button>
      </div>
    );
  }

  const getCharacterDefaultImageUrl = (character: Character) => {
    const defaultExpr = character.expressions.find(e => e.id === character.defaultExpressionId);
    return defaultExpr?.imageUrl || character.expressions[0]?.imageUrl || '';
  };

  return (
    <div className="w-screen h-screen bg-gray-800 text-white flex flex-col font-sans overflow-hidden">
      <header className="flex-shrink-0 bg-gray-900 p-2 flex items-center justify-between shadow-md z-10">
        <h1 className="text-xl font-bold">Visual Novel Creator</h1>
        <div className="flex items-center gap-2">
            <button onClick={handleSave} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded" title="Save to Browser"><SaveIcon className="w-5 h-5" /> Save</button>
            <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
            <button onClick={handleImportClick} className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded"><UploadIcon className="w-5 h-5" /> Import JSON</button>
            <button onClick={handleExportToJson} className="flex items-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-500 rounded"><DownloadIcon className="w-5 h-5" /> Export JSON</button>
            <button onClick={handleExportToRenpy} className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded"><DownloadIcon className="w-5 h-5" /> Export to Ren'Py</button>
            <button onClick={handleReset} className="flex items-center gap-2 px-3 py-2 bg-red-700 hover:bg-red-600 rounded"><ResetIcon className="w-5 h-5" /> Reset</button>
            <button onClick={() => { setCurrentSceneId(vn.startSceneId); setMode('play'); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded"><PlayIcon className="w-5 h-5" /> Play</button>
        </div>
      </header>
      <div className="flex flex-grow overflow-hidden">
        <aside className="w-1/3 bg-gray-700 p-4 overflow-y-auto flex flex-col gap-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="font-bold mb-2 text-lg flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-yellow-400" /> AI Story Generator</h2>
             <input type="text" value={aiTheme} onChange={e => setAiTheme(e.target.value)} placeholder="e.g., 'haunted house mystery'" className="w-full p-2 bg-gray-900 rounded border border-gray-600 mt-1" disabled={isGenerating}/>
            <button onClick={handleGenerateStory} disabled={isGenerating || !aiTheme.trim()} className="w-full mt-2 p-2 bg-indigo-600 hover:bg-indigo-500 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors">Generate with Theme</button>
            {isGenerating && <p className="text-center text-yellow-400 text-sm mt-3 animate-pulse">Generating story...</p>}
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="font-bold mb-2">Game Settings</h2>
            <label>Title</label>
            <input type="text" value={vn.title} onChange={e => updateVn(d => ({...d, title: e.target.value}))} className="w-full p-2 bg-gray-900 rounded border border-gray-600" />
            <label className="mt-2 block">Start Scene</label>
            <select value={vn.startSceneId} onChange={e => updateVn(d => ({...d, startSceneId: e.target.value}))} className="w-full p-2 bg-gray-900 rounded border border-gray-600">
                {vn.scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-bold text-lg">Characters</h2>
              <button onClick={handleAddCharacter} className="p-1 bg-green-600 hover:bg-green-500 rounded"><PlusIcon className="w-5 h-5"/></button>
            </div>
            <div className="space-y-3">
              {vn.characters.map(char => (
                <div key={char.id} className="bg-gray-700 p-3 rounded">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-24 bg-gray-900 rounded-sm flex-shrink-0">
                      <img src={getCharacterDefaultImageUrl(char)} alt={char.name} className="w-full h-full object-cover rounded-sm"/>
                    </div>
                    <div className="flex-grow">
                      <input type="text" value={char.name} onChange={e => handleCharacterChange(char.id, 'name', e.target.value)} className="w-full p-1 bg-gray-600 rounded font-bold" />
                    </div>
                    <button onClick={() => handleDeleteCharacter(char.id)} className="p-1 text-red-400 hover:text-red-300"><TrashIcon className="w-5 h-5"/></button>
                  </div>
                  <div className="mt-3 space-y-2">
                    <h4 className="text-sm font-semibold text-gray-300">Expressions:</h4>
                    {char.expressions.map(expr => (
                      <div key={expr.id} className="flex items-center gap-2 text-sm">
                        <input type="radio" name={`default-expr-${char.id}`} checked={char.defaultExpressionId === expr.id} onChange={() => handleSetDefaultExpression(char.id, expr.id)} title="Set as default expression" />
                        <input type="text" value={expr.name} onChange={e => handleExpressionChange(char.id, expr.id, 'name', e.target.value)} className="p-1 bg-gray-600 rounded w-20" />
                        <input type="text" placeholder="Image URL" value={expr.imageUrl} onChange={e => handleExpressionChange(char.id, expr.id, 'imageUrl', e.target.value)} className="flex-grow p-1 bg-gray-600 rounded" />
                        <input type="file" accept="image/*" onChange={(e) => handleExpressionImageUpload(e, char.id, expr.id)} className="w-12 text-xs" />
                        <button onClick={() => handleDeleteExpression(char.id, expr.id)} className="p-1 text-red-500 hover:text-red-400"><TrashIcon className="w-4 h-4"/></button>
                      </div>
                    ))}
                     <button onClick={() => handleAddExpression(char.id)} className="text-xs p-1 mt-2 w-full bg-gray-600 hover:bg-gray-500 rounded">+ Add Expression</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-bold text-lg">Scene Tree</h2>
              <button onClick={handleAddScene} className="p-1 bg-green-600 hover:bg-green-500 rounded" title="Add new scene"><PlusIcon className="w-5 h-5"/></button>
            </div>
             <SceneTree vn={vn} selectedSceneId={selectedSceneId} onSelectScene={setSelectedSceneId} />
          </div>
        </aside>
        <main className="w-2/3 bg-gray-900 p-4 overflow-y-auto">
          {selectedScene ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Editing Scene: {selectedScene.name}</h2>
                 <button onClick={() => handleDeleteScene(selectedScene.id)} className="p-2 text-red-400 hover:text-red-300 flex items-center gap-1"><TrashIcon className="w-5 h-5"/> Delete Scene</button>
              </div>
              <div>
                <label>Scene Name</label>
                <input type="text" value={selectedScene.name} onChange={e => handleSceneChange(selectedScene.id, 'name', e.target.value)} className="w-full p-2 bg-gray-800 rounded border border-gray-600" />
              </div>
              <div className="bg-gray-800 p-4 rounded-lg border border-indigo-500/30">
                  <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-yellow-400" /> AI Scene Assistant</h3>
                  <textarea id="ai-scene-prompt" rows={3} value={selectedScene.aiPrompt || ''} onChange={e => handleSceneChange(selectedScene.id, 'aiPrompt', e.target.value)} placeholder="e.g., a tense negotiation in a futuristic, neon-lit bar." className="w-full p-2 bg-gray-700 rounded border border-gray-600" disabled={isGeneratingBg || isGeneratingDialogue}/>
                  <div className="flex items-center gap-4 mt-3">
                      <button onClick={handleGenerateBg} disabled={!selectedScene.aiPrompt?.trim() || isGeneratingBg || isGeneratingDialogue} className="flex-1 p-2 bg-indigo-600 hover:bg-indigo-500 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"><SparklesIcon className="w-5 h-5" />{isGeneratingBg ? 'Generating...' : 'Generate Background'}</button>
                      <button onClick={handleGenerateDialogue} disabled={!selectedScene.aiPrompt?.trim() || isGeneratingBg || isGeneratingDialogue} className="flex-1 p-2 bg-teal-600 hover:bg-teal-500 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2" title={selectedScene.presentCharacterIds.length === 0 ? "Add characters to the scene first" : ""}><SparklesIcon className="w-5 h-5" />{isGeneratingDialogue ? 'Generating...' : 'Generate Dialogue'}</button>
                  </div>
              </div>
              <div>
                <label>Background Image</label>
                <div className="flex items-start gap-4">
                    <div className="w-48 h-27 bg-gray-800 rounded flex-shrink-0">
                        {selectedScene.backgroundUrl && <img src={selectedScene.backgroundUrl} alt="background" className="w-full h-full object-cover rounded"/>}
                    </div>
                    <div className="flex-grow">
                        <input type="text" placeholder="Background Image URL" value={selectedScene.backgroundUrl} onChange={e => handleSceneChange(selectedScene.id, 'backgroundUrl', e.target.value)} className="w-full p-2 bg-gray-800 rounded border border-gray-600" />
                         <input type="file" accept="image/*" onChange={(e) => handleSceneBgUpload(e, selectedScene.id)} className="w-full text-sm mt-2" />
                    </div>
                </div>
              </div>
              <div>
                <label className="block mb-1 font-medium">Characters in Scene</label>
                <div className="flex flex-wrap gap-x-4 gap-y-2 p-2 bg-gray-800 rounded border border-gray-600">
                    {vn.characters.length > 0 ? vn.characters.map(char => (
                    <label key={char.id} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={selectedScene.presentCharacterIds.includes(char.id)} onChange={e => handlePresentCharacterToggle(selectedScene.id, char.id, e.target.checked)} className="h-4 w-4 accent-indigo-500 bg-gray-700 border-gray-500 rounded focus:ring-indigo-500"/>
                        {char.name}
                    </label>
                    )) : <p className="text-gray-500 text-sm">No characters created yet.</p>}
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-lg">Dialogue</h3>
                    <button onClick={() => handleAddDialogueLine(selectedScene.id)} className="p-1 bg-green-600 hover:bg-green-500 rounded" title="Add dialogue line"><PlusIcon className="w-5 h-5"/></button>
                </div>
                <div className="space-y-2">
                  {selectedScene.dialogue.map((line, index) => {
                    const speaker = vn.characters.find(c => c.id === line.characterId);
                    return (
                        <div key={index} className="flex items-start gap-2 bg-gray-800 p-2 rounded">
                            <div className="flex flex-col gap-1 w-40 flex-shrink-0">
                                <select value={line.characterId || ''} onChange={e => handleDialogueLineChange(selectedScene.id, index, 'characterId', e.target.value || null)} className="p-1 bg-gray-700 rounded">
                                    <option value="">Narrator</option>
                                    {vn.characters.filter(c => selectedScene.presentCharacterIds.includes(c.id)).map(char => <option key={char.id} value={char.id}>{char.name}</option>)}
                                </select>
                                {speaker && (
                                <select value={line.expressionId || ''} onChange={e => handleDialogueLineChange(selectedScene.id, index, 'expressionId', e.target.value || null)} className="p-1 bg-gray-700 rounded text-sm">
                                    <option value="">Default Expression</option>
                                    {speaker.expressions.map(expr => <option key={expr.id} value={expr.id}>{expr.name}</option>)}
                                </select>
                                )}
                            </div>
                            <textarea value={line.text} onChange={e => handleDialogueLineChange(selectedScene.id, index, 'text', e.target.value)} rows={3} className="flex-grow p-1 bg-gray-700 rounded" placeholder="Dialogue text..."/>
                            <button onClick={() => handleDeleteDialogueLine(selectedScene.id, index)} className="p-1 text-red-400 hover:text-red-300 flex-shrink-0"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-lg">Choices</h3>
                    <button onClick={() => handleAddChoice(selectedScene.id)} className="p-1 bg-green-600 hover:bg-green-500 rounded"><PlusIcon className="w-5 h-5"/></button>
                </div>
                <div className="space-y-2">
                  {selectedScene.choices.map((choice, index) => (
                    <div key={index} className="flex items-center gap-2 bg-gray-800 p-2 rounded">
                      <input type="text" value={choice.text} onChange={e => handleChoiceChange(selectedScene.id, index, 'text', e.target.value)} className="flex-grow p-1 bg-gray-700 rounded" placeholder="Choice Text" />
                      <span className="text-gray-400">→</span>
                      <select value={choice.nextSceneId} onChange={e => handleChoiceChange(selectedScene.id, index, 'nextSceneId', e.target.value)} className="p-1 bg-gray-700 rounded">
                        {vn.scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <button onClick={() => handleDeleteChoice(selectedScene.id, index)} className="p-1 text-red-400 hover:text-red-300"><TrashIcon className="w-5 h-5"/></button>
                    </div>
                  ))}
                  {selectedScene.choices.length === 0 && <p className="text-gray-500 text-center py-2">This is an ending scene.</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Select a scene from the left panel to edit.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;