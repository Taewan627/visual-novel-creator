import { VisualNovel } from '../types';

function sanitizeForRenpy(name: string, type: 'variable' | 'filename'): string {
    let sanitized = name
        .replace(/[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣_ ]/g, '') // Allow Korean, alphanumeric, underscore, space
        .trim()
        .replace(/\s+/g, '_'); // Replace spaces with underscores

    if (type === 'variable') {
        return sanitized.toLowerCase();
    }
    // For filenames, keep it simple
    return sanitized;
}

export function convertToRenpyScript(vn: VisualNovel): string {
    let script = `# Ren'Py Script - ${vn.title}\n\n`;
    script += `# Character Definitions\n`;

    const characterMap = new Map<string, string>();
    vn.characters.forEach(char => {
        const varName = `c_${sanitizeForRenpy(char.name, 'variable')}`;
        characterMap.set(char.id, varName);
        script += `define ${varName} = Character("${char.name}")\n`;
    });
    script += `\n`;

    // Image Definitions
    const imageDefinitions = new Map<string, string>(); // Maps sceneId to bg tag
    const characterImageDefinitions = new Map<string, string>(); // Maps characterId to default expression tag
    
    vn.characters.forEach(char => {
        const charVarName = `c_${sanitizeForRenpy(char.name, 'variable')}`;
        char.expressions.forEach(expr => {
            const exprTagName = sanitizeForRenpy(expr.name, 'variable');
            const fileName = `char_${sanitizeForRenpy(char.name, 'filename')}_${sanitizeForRenpy(expr.name, 'filename')}.png`;
            script += `image ${charVarName}_${exprTagName} = "images/${fileName}"\n`;
            if (char.defaultExpressionId === expr.id) {
                characterImageDefinitions.set(char.id, `${charVarName}_${exprTagName}`);
            }
        });
    });

    vn.scenes.forEach(scene => {
        if (scene.backgroundUrl) {
            const tagName = `bg_${sanitizeForRenpy(scene.name, 'variable')}`;
            const fileName = `bg_${sanitizeForRenpy(scene.name, 'filename')}.png`;
            imageDefinitions.set(scene.id, tagName);
            script += `image ${tagName} = "images/${fileName}"\n`;
        }
    });

    script += `\n# The game starts here.\nlabel start:\n`;
    script += `    jump ${sanitizeForRenpy(vn.scenes.find(s=>s.id === vn.startSceneId)?.name || 'scene_1', 'variable')}\n\n`;

    // Scene Generation
    vn.scenes.forEach(scene => {
        script += `label ${sanitizeForRenpy(scene.name, 'variable')}:\n`;

        const bgTag = imageDefinitions.get(scene.id);
        script += `    scene ${bgTag || 'black'}\n`;

        const presentCharacters = scene.presentCharacterIds
            .map(id => ({ id, tag: characterImageDefinitions.get(id) }))
            .filter(item => item.tag);

        if (presentCharacters.length === 1) {
             script += `    show ${presentCharacters[0].tag} at center\n`;
        } else if (presentCharacters.length > 1) {
            script += `    show ${presentCharacters[0].tag} at left\n`;
            if (presentCharacters[1]) {
                script += `    show ${presentCharacters[1].tag} at right\n`;
            }
            // More than 2 characters might need manual position adjustment
        }

        // Dialogue Generation
        scene.dialogue.forEach(line => {
            const characterVar = line.characterId ? characterMap.get(line.characterId) : null;
            const text = line.text.replace(/"/g, '\\"');
            
            if (characterVar) {
                const character = vn.characters.find(c => c.id === line.characterId);
                const expression = character?.expressions.find(e => e.id === line.expressionId);
                const expressionTag = expression ? ` ${sanitizeForRenpy(expression.name, 'variable')}` : '';

                const charVarName = `c_${sanitizeForRenpy(character?.name || '', 'variable')}`;
                const exprTagName = expression ? sanitizeForRenpy(expression.name, 'variable') : '';

                if (character && expression) {
                    // Show specific expression
                    script += `    show ${charVarName}_${exprTagName}\n`;
                }

                script += `    ${characterVar} "${text}"\n`;

            } else {
                script += `    "${text}"\n`;
            }
        });

        if (scene.choices.length > 0) {
            script += `    menu:\n`;
            scene.choices.forEach(choice => {
                const nextSceneLabel = sanitizeForRenpy(vn.scenes.find(s=>s.id === choice.nextSceneId)?.name || '', 'variable');
                const choiceText = choice.text.replace(/"/g, '\\"');
                if(nextSceneLabel) {
                    script += `        "${choiceText}":\n`;
                    script += `            jump ${nextSceneLabel}\n`;
                }
            });
        } else {
            script += `    return\n`;
        }
        script += `\n`;
    });

    return script;
}

export function exportVnToJson(vn: VisualNovel) {
  try {
    const jsonString = JSON.stringify(vn, null, 2); // Pretty print JSON
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `${sanitizeForRenpy(vn.title, 'filename') || 'visual-novel'}.json`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to export to JSON", error);
    alert("Failed to export to JSON file.");
  }
}