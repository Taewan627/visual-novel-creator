import React, { useState, useEffect } from 'react';
import { VisualNovel, Character, Expression } from '../types';

interface GamePlayerProps {
  vn: VisualNovel;
  currentSceneId: string;
  onChoice: (nextSceneId: string) => void;
}

const GamePlayer: React.FC<GamePlayerProps> = ({ vn, currentSceneId, onChoice }) => {
  const [dialogueIndex, setDialogueIndex] = useState(0);

  const currentScene = vn.scenes.find(s => s.id === currentSceneId);

  useEffect(() => {
    setDialogueIndex(0);
  }, [currentSceneId]);

  if (!currentScene) {
    return (
      <div className="flex-grow flex items-center justify-center bg-gray-900 text-white p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500">Error!</h2>
          <p className="mt-2">Scene with ID "{currentSceneId}" could not be found.</p>
        </div>
      </div>
    );
  }
  
  const currentDialogueLine = currentScene.dialogue[dialogueIndex];
  const isLastDialogue = dialogueIndex >= currentScene.dialogue.length - 1;

  const handleAdvance = () => {
    if (!isLastDialogue) {
      setDialogueIndex(prev => prev + 1);
    }
  };
  
  const speakingCharacter = currentDialogueLine?.characterId
    ? vn.characters.find(c => c.id === currentDialogueLine.characterId)
    : null;

  const presentCharacters = currentScene.presentCharacterIds
    .map(id => vn.characters.find(c => c.id === id))
    .filter((c): c is Character => c !== undefined);
  
  const getCharacterImageUrl = (character: Character): string => {
    let expression: Expression | undefined;
    if (character.id === speakingCharacter?.id && currentDialogueLine?.expressionId) {
      expression = character.expressions.find(e => e.id === currentDialogueLine.expressionId);
    }
    
    if (!expression) {
       expression = character.expressions.find(e => e.id === character.defaultExpressionId);
    }

    if (!expression && character.expressions.length > 0) {
      expression = character.expressions[0];
    }
    
    return expression?.imageUrl || "https://picsum.photos/400/600"; // Fallback
  };


  const getCharacterStyle = (index: number, total: number, isSpeaking: boolean): React.CSSProperties => {
    const style: React.CSSProperties = {
        bottom: 0,
        height: '85%',
        transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        filter: isSpeaking ? 'brightness(1)' : 'brightness(0.6)',
        transform: isSpeaking ? 'scale(1)' : 'scale(0.95)',
        zIndex: isSpeaking ? 10 : 5,
    };
    if (total <= 1) {
        style.left = '50%';
        style.transform += ' translateX(-50%)';
    } else {
        const percentage = (index / (total - 1)) * 70 + 15; // spread from 15% to 85%
        style.left = `${percentage}%`;
        style.transform += ' translateX(-50%)';
    }
    return style;
  };


  return (
    <div className="w-full h-full flex flex-col bg-black relative text-white cursor-pointer" onClick={handleAdvance}>
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
        style={{ backgroundImage: `url(${currentScene.backgroundUrl})` }}
      >
        <div className="absolute inset-0 bg-black/20"></div>
      </div>

      {/* Character Sprites */}
       <div className="absolute inset-0 overflow-hidden">
        {presentCharacters.map((char, index) => (
            <div
                key={char.id}
                className="absolute"
                style={getCharacterStyle(index, presentCharacters.length, char.id === speakingCharacter?.id)}
            >
                <img 
                    src={getCharacterImageUrl(char)} 
                    alt={char.name} 
                    className="max-h-full max-w-none object-contain drop-shadow-[0_5px_15px_rgba(0,0,0,0.7)]"
                />
            </div>
        ))}
       </div>

      {/* Dialogue Box */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 bg-black/70 backdrop-blur-sm m-4 rounded-xl border border-gray-700 cursor-default z-20">
        {speakingCharacter && (
          <div className="absolute -top-8 left-8 bg-gray-800 text-white px-6 py-2 rounded-t-lg border-t border-l border-r border-gray-600 text-xl font-bold">
            {speakingCharacter.name}
          </div>
        )}
        <p className={`text-lg md:text-xl leading-relaxed ${!speakingCharacter ? 'pt-2' : ''}`}>
          {currentDialogueLine?.text || ''}
        </p>
        
        {/* Choices */}
        {isLastDialogue && currentScene.choices.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentScene.choices.map((choice, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation(); // prevent advancing dialogue
                  onChoice(choice.nextSceneId);
                }}
                className="w-full text-left p-4 bg-indigo-600/50 hover:bg-indigo-500 border border-indigo-400 rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
              >
                {choice.text}
              </button>
            ))}
          </div>
        )}
         {isLastDialogue && currentScene.choices.length === 0 && (
            <div className="mt-4 text-center text-gray-400">~ The End ~</div>
         )}
         {!isLastDialogue && (
            <div className="absolute bottom-2 right-4 text-white animate-pulse">▼</div>
         )}
      </div>
    </div>
  );
};

export default GamePlayer;