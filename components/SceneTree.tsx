import React from 'react';
import { VisualNovel, Scene } from '../types';

interface SceneNodeProps {
  scene: Scene;
  vn: VisualNovel;
  selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
  visited: Set<string>;
  isFirstLevel?: boolean;
}

const SceneNode: React.FC<SceneNodeProps> = ({ scene, vn, selectedSceneId, onSelectScene, visited, isFirstLevel = false }) => {
  const isSelected = scene.id === selectedSceneId;
  const isStart = scene.id === vn.startSceneId;

  if (visited.has(scene.id)) {
    return (
      <div className="flex items-center gap-2 pl-4 text-sm text-yellow-400 relative">
        {!isFirstLevel && <div className="absolute left-[-0.5rem] top-4 w-4 h-px bg-gray-500"></div>}
        <span>⮐</span>
        <span>Loop: {scene.name}</span>
      </div>
    );
  }
  visited.add(scene.id);

  const childScenes = scene.choices
    .map(choice => ({
      choiceText: choice.text,
      scene: vn.scenes.find(s => s.id === choice.nextSceneId)
    }))
    .filter(item => item.scene);

  return (
    <div className="relative">
      {!isFirstLevel && <div className="absolute left-[-0.5rem] top-4 w-4 h-px bg-gray-500"></div>}
      <div
        onClick={() => onSelectScene(scene.id)}
        className={`flex items-center gap-2 p-1.5 my-1 rounded cursor-pointer transition-colors ${isSelected ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        role="button"
        aria-pressed={isSelected}
        tabIndex={0}
      >
        <span className="text-lg" aria-hidden="true">{isStart ? '🏁' : '📄'}</span>
        <span className="font-medium">{scene.name}</span>
      </div>

      {childScenes.length > 0 && (
        <div className="pl-4 border-l-2 border-gray-600 ml-4">
          {childScenes.map(({ choiceText, scene }, index) => (
            <div key={scene!.id + index} className="relative pt-3">
                 <div className="absolute left-[-0.6rem] top-[-0.1rem] text-xs text-indigo-300 bg-gray-800 px-1 rounded truncate max-w-[90%]">
                    &quot;{choiceText}&quot;
                 </div>
                 <SceneNode
                    scene={scene!}
                    vn={vn}
                    selectedSceneId={selectedSceneId}
                    onSelectScene={onSelectScene}
                    visited={new Set(visited)}
                 />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SceneTree: React.FC<{ vn: VisualNovel; selectedSceneId: string | null; onSelectScene: (id: string) => void; }> = ({ vn, selectedSceneId, onSelectScene }) => {
  const sceneMap = new Map(vn.scenes.map(s => [s.id, s]));
  const reachableSceneIds = new Set<string>();
  
  if (vn.startSceneId && sceneMap.has(vn.startSceneId)) {
    const queue: string[] = [vn.startSceneId];
    reachableSceneIds.add(vn.startSceneId);
    let head = 0;
    while(head < queue.length) {
      const currentId = queue[head++];
      const scene = sceneMap.get(currentId);
      if(scene) {
        scene.choices.forEach(choice => {
          if (choice.nextSceneId && !reachableSceneIds.has(choice.nextSceneId)) {
            reachableSceneIds.add(choice.nextSceneId);
            queue.push(choice.nextSceneId);
          }
        });
      }
    }
  }

  const startScene = sceneMap.get(vn.startSceneId);
  const orphanScenes = vn.scenes.filter(s => !reachableSceneIds.has(s.id));

  return (
    <div className="space-y-4">
      {startScene ? (
         <SceneNode
            scene={startScene}
            vn={vn}
            selectedSceneId={selectedSceneId}
            onSelectScene={onSelectScene}
            visited={new Set()}
            isFirstLevel={true}
          />
      ) : (
        <p className="text-red-400 p-2">Error: Start scene not found!</p>
      )}

      {orphanScenes.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-400 mt-6 mb-2 border-t border-gray-600 pt-4">Unconnected Scenes</h3>
          <div className="space-y-1">
            {orphanScenes.map(scene => (
               <div
                  key={scene.id}
                  onClick={() => onSelectScene(scene.id)}
                  className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${selectedSceneId === scene.id ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                  role="button"
                  aria-pressed={selectedSceneId === scene.id}
                  tabIndex={0}
                >
                  <span className="text-lg" aria-hidden="true">📄</span>
                  <span className="font-medium">{scene.name}</span>
                </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SceneTree;