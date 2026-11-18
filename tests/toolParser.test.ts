import { describe, it, expect } from "vitest";

/**
 * TESTS PARA PARSER DE TOOL CALLS
 * 
 * Este archivo contiene tests unitarios para las funciones collectToolCalls y extractCleanText
 * del módulo llm.ts. El objetivo es cubrir todos los casos de tags malformados que pueden
 * aparecer en el stream del LLM.
 * 
 * PROBLEMAS CONOCIDOS (marcados con "KNOWN ISSUE" en los tests):
 * 
 * 1. Tags sin cierre seguidos de texto: El regex captura el texto como parte del JSON
 *    - Input: <tool name="a">{}</tool>Texto
 *    - Problema: Captura "}Texto" como parte del JSON
 *    - Solución: Mejorar el regex para detenerse en caracteres no-JSON después del JSON
 * 
 * 2. Espacios múltiples en atributos: El regex name="([^"]+)" no acepta espacios
 *    - Input: <tool  name="a"  >{}</tool>
 *    - Problema: Regex falla con espacios múltiples
 *    - Solución: Usar \s* antes/después de name="
 * 
 * 3. Name vacío: El regex name="([^"]+)" requiere al menos 1 carácter
 *    - Input: <tool name="">{}</tool>
 *    - Problema: Regex falla con string vacío
 *    - Solución: Cambiar + por * para permitir vacío
 * 
 * 4. Tags sin cierre sin lookahead: Solo elimina si hay otro <tool después
 *    - Input: Texto<tool name="a">{}Más
 *    - Problema: El regex sin cierre requiere lookahead (?=<tool\s+name=|$)
 *    - Solución: El regex actual es limitado pero funciona en la mayoría de casos
 * 
 * 5. JSON incompleto: JSON.parse lanza SyntaxError
 *    - Input: <tool name="a">{ "path":
 *    - Problema: No hay manejo de errores para JSON incompleto
 *    - Solución: Try-catch en collectToolCalls y omitir JSON inválido
 * 
 * 6. Tags anidados: El contenido incluye otro tag no es JSON válido
 *    - Input: <tool name="a"><tool name="b">{}</tool></tool>
 *    - Problema: El primer tag captura el segundo tag en su contenido
 *    - Solución: Validar que el contenido sea JSON válido antes de parsear
 * 
 * CASOS QUE FUNCIONAN CORRECTAMENTE:
 * - Tags bien formados con cierre </tool>
 * - Múltiples tool calls consecutivos
 * - Tags sin cierre al final del buffer
 * - JSON con newlines, tabs, escapes
 * - JSON con objetos anidados y arrays
 * - Mezcla de texto y tool calls
 */

// Copia de las funciones de llm.ts para testearlas
interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

function collectToolCalls(rawBuffer: string): ToolCall[] {
  const toolRegex = /<tool\s+name="([^"]+)">([\s\S]*?)(?:<\/tool>|(?=<tool\s+name=|$))/g;
  const toolCalls: ToolCall[] = [];
  let match: RegExpExecArray | null;

  while ((match = toolRegex.exec(rawBuffer)) !== null) {
    toolCalls.push({
      name: match[1],
      args: JSON.parse(match[2]) as Record<string, unknown>
    });
  }

  return toolCalls;
}

function extractCleanText(rawBuffer: string): string {
  return rawBuffer
    .replace(/<tool\s+name="[^"]*">[\s\S]*?<\/tool>/g, "")
    .replace(/<tool\s+name="[^"]*">[\s\S]*?(?=<tool\s+name=|$)/g, "")
    .replace(/<\/tool>/g, "")
    .trim();
}

describe("Tool Parser - collectToolCalls", () => {
  it("debería extraer un tool call bien formado con cierre", () => {
    const input = '<tool name="createFile">{ "path": "test.txt", "content": "hola" }</tool>';
    const result = collectToolCalls(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("createFile");
    expect(result[0].args).toEqual({ path: "test.txt", content: "hola" });
  });

  it("debería extraer múltiples tool calls bien formados", () => {
    const input = '<tool name="createFile">{ "path": "a.txt" }</tool>Texto<tool name="deleteFile">{ "path": "b.txt" }</tool>';
    const result = collectToolCalls(input);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("createFile");
    expect(result[1].name).toBe("deleteFile");
  });

  it("debería extraer tool call sin cierre (malformado)", () => {
    const input = '<tool name="createFile">{ "path": "test.txt" }';
    const result = collectToolCalls(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("createFile");
    expect(result[0].args).toEqual({ path: "test.txt" });
  });

  it("debería extraer tool call sin cierre seguido de texto - KNOWN ISSUE: captura texto como parte del JSON", () => {
    const input = '<tool name="createFile">{ "path": "test.txt" }Texto adicional';
    // El regex actual captura hasta el final, incluyendo "Texto adicional"
    // Esto causa error de JSON parse porque captura más del JSON válido
    expect(() => collectToolCalls(input)).toThrow(SyntaxError);
  });

  it("debería extraer tool call sin cierre seguido de otro tool call", () => {
    const input = '<tool name="createFile">{ "path": "a.txt" }<tool name="deleteFile">{ "path": "b.txt" }</tool>';
    const result = collectToolCalls(input);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("createFile");
    expect(result[1].name).toBe("deleteFile");
  });

  it("debería manejar tags duplicados consecutivos sin cierre", () => {
    const input = '<tool name="createFile">{ "path": "a.txt" }<tool name="createFile">{ "path": "b.txt" }';
    const result = collectToolCalls(input);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("createFile");
    expect(result[1].name).toBe("createFile");
  });

  it("debería lanzar error con JSON malformado dentro del tag", () => {
    const input = '<tool name="createFile">{ path: "test.txt" }';
    expect(() => collectToolCalls(input)).toThrow();
  });

  it("debería manejar JSON vacío", () => {
    const input = '<tool name="ping">{}</tool>';
    const result = collectToolCalls(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("ping");
    expect(result[0].args).toEqual({});
  });

  it("debería manejar JSON con caracteres especiales", () => {
    const input = '<tool name="createFile">{ "path": "test.txt", "content": "hola \\"mundo\\"" }</tool>';
    const result = collectToolCalls(input);
    expect(result).toHaveLength(1);
    expect(result[0].args.content).toBe('hola "mundo"');
  });

  it("debería manejar JSON con newlines y tabs", () => {
    const input = '<tool name="createFile">{\n  "path": "test.txt",\n  "content": "hola"\n}</tool>';
    const result = collectToolCalls(input);
    expect(result).toHaveLength(1);
    expect(result[0].args).toEqual({ path: "test.txt", content: "hola" });
  });

  it("debería manejar tool calls mezclados con texto normal", () => {
    const input = 'Hola usuario<tool name="createFile">{ "path": "test.txt" }</tool>Adiós';
    const result = collectToolCalls(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("createFile");
  });

  it("debería manejar nombre de herramienta con espacios extra - KNOWN ISSUE: regex no acepta espacios múltiples", () => {
    const input = '<tool  name="createFile" >{ "path": "test.txt" }</tool>';
    // El regex actual `name="([^"]+)"` no acepta espacios múltiples
    const result = collectToolCalls(input);
    expect(result).toHaveLength(0); // El regex falla con espacios múltiples
  });

  it("debería ignorar tags que no son <tool>", () => {
    const input = '<notatool>texto</notatool><tool name="createFile">{ "path": "test.txt" }</tool>';
    const result = collectToolCalls(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("createFile");
  });

  it("debería manejar buffer vacío", () => {
    const result = collectToolCalls("");
    expect(result).toHaveLength(0);
  });

  it("debería manejar buffer sin tool calls", () => {
    const result = collectToolCalls("Hola mundo, cómo estás?");
    expect(result).toHaveLength(0);
  });

  it("debería manejar tag con cierre parcial (solo </tool> sin apertura)", () => {
    const input = 'Texto</tool><tool name="createFile">{ "path": "test.txt" }</tool>';
    const result = collectToolCalls(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("createFile");
  });

  it("debería manejar tool tag sin contenido JSON (solo <tool name=\"a\">) - KNOWN ISSUE: SyntaxError", () => {
    const input = '<tool name="a">';
    // El regex captura el contenido vacío y JSON.parse falla
    expect(() => collectToolCalls(input)).toThrow(SyntaxError);
  });

  it("debería manejar tool tag sin contenido JSON pero con cierre - KNOWN ISSUE: SyntaxError", () => {
    const input = '<tool name="a"></tool>';
    // El regex captura string vacío y JSON.parse falla
    expect(() => collectToolCalls(input)).toThrow(SyntaxError);
  });

  it("debería manejar tool tag incompleto en <tool name=", () => {
    const input = '<tool name=';
    const result = collectToolCalls(input);
    // El regex no captura porque está incompleto (falta el valor de name)
    expect(result).toHaveLength(0);
  });

  it("debería manejar tool tag incompleto en <tool name=\"", () => {
    const input = '<tool name="';
    const result = collectToolCalls(input);
    // El regex no captura porque está incompleto (falta el valor de name y cierre >)
    expect(result).toHaveLength(0);
  });

  it("debería manejar tool tag incompleto en <tool", () => {
    const input = '<tool';
    const result = collectToolCalls(input);
    // El regex no captura porque está incompleto (falta name=)
    expect(result).toHaveLength(0);
  });

  it("debería manejar tag con name vacío - KNOWN ISSUE: regex requiere al menos un carácter", () => {
    const input = '<tool name="">{ "path": "test.txt" }</tool>';
    // El regex actual `name="([^"]+)"` usa `+` que requiere al menos 1 carácter
    const result = collectToolCalls(input);
    expect(result).toHaveLength(0); // El regex falla con name vacío
  });

  it("debería manejar múltiples tags sin cierre al final del buffer", () => {
    const input = '<tool name="a">{}</tool><tool name="b">{}</tool><tool name="c">{}</tool>';
    const result = collectToolCalls(input);
    expect(result).toHaveLength(3);
    expect(result.map(r => r.name)).toEqual(["a", "b", "c"]);
  });

  it("debería manejar tags con JSON complejo (nested objects)", () => {
    const input = '<tool name="createFile">{ "path": "test.txt", "metadata": { "author": "me", "date": "2024" } }</tool>';
    const result = collectToolCalls(input);
    expect(result).toHaveLength(1);
    expect(result[0].args.metadata).toEqual({ author: "me", date: "2024" });
  });

  it("debería manejar tags con arrays en JSON", () => {
    const input = '<tool name="createFile">{ "paths": ["a.txt", "b.txt"] }</tool>';
    const result = collectToolCalls(input);
    expect(result).toHaveLength(1);
    expect(result[0].args.paths).toEqual(["a.txt", "b.txt"]);
  });

  it("debería manejar tag malformado con comillas simples en name (no debería matchear)", () => {
    const input = "<tool name='createFile'>{ 'path': 'test.txt' }</tool>";
    const result = collectToolCalls(input);
    // El regex espera comillas dobles, así que no debería matchear
    expect(result).toHaveLength(0);
  });

  it("debería manejar tag sin atributo name (no debería matchear)", () => {
    const input = '<tool>{ "path": "test.txt" }</tool>';
    const result = collectToolCalls(input);
    expect(result).toHaveLength(0);
  });

  it("debería manejar tag con name con caracteres especiales", () => {
    const input = '<tool name="create_file_test">{ "path": "test.txt" }</tool>';
    const result = collectToolCalls(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("create_file_test");
  });

  it("debería manejar tool call con escape de comillas en JSON", () => {
    const input = '<tool name="createFile">{ "content": "Linea1\\nLinea2" }</tool>';
    const result = collectToolCalls(input);
    expect(result).toHaveLength(1);
    expect(result[0].args.content).toBe("Linea1\nLinea2");
  });
});

describe("Tool Parser - extractCleanText", () => {
  it("debería eliminar tool calls con cierre y dejar texto limpio", () => {
    const input = 'Hola<tool name="createFile">{ "path": "test.txt" }</tool>Adiós';
    const result = extractCleanText(input);
    expect(result).toBe("HolaAdiós");
  });

  it("debería eliminar tool calls sin cierre y dejar texto limpio - KNOWN ISSUE: solo elimina si hay lookahead", () => {
    const input = 'Hola<tool name="createFile">{ "path": "test.txt" }Adiós';
    // El regex solo elimina si hay otro <tool name= después o fin de string
    // Como no hay otro tool, no elimina el tag malformado
    const result = extractCleanText(input);
    expect(result).toBe("Hola"); // Solo limpia el texto inicial
  });

  it("debería eliminar múltiples tool calls", () => {
    const input = 'Inicio<tool name="a">{}</tool>Medio<tool name="b">{}</tool>Fin';
    const result = extractCleanText(input);
    expect(result).toBe("InicioMedioFin");
  });

  it("debería eliminar tags de cierre huérfanos", () => {
    const input = 'Texto</tool>Más texto';
    const result = extractCleanText(input);
    expect(result).toBe("TextoMás texto");
  });

  it("debería manejar texto sin tool calls", () => {
    const input = "Hola mundo, cómo estás?";
    const result = extractCleanText(input);
    expect(result).toBe("Hola mundo, cómo estás?");
  });

  it("debería manejar string vacío", () => {
    const result = extractCleanText("");
    expect(result).toBe("");
  });

  it("debería manejar solo tool calls sin texto", () => {
    const input = '<tool name="createFile">{ "path": "test.txt" }</tool>';
    const result = extractCleanText(input);
    expect(result).toBe("");
  });

  it("debería manejar tool calls con JSON complejo", () => {
    const input = '<tool name="createFile">{ "content": "muy largo..." }</tool>Texto después';
    const result = extractCleanText(input);
    expect(result).toBe("Texto después");
  });

  it("debería preservar espacios entre texto", () => {
    const input = 'Hola <tool name="a">{}</tool> mundo';
    const result = extractCleanText(input);
    expect(result).toBe("Hola  mundo");
  });

  it("debería manejar tags duplicados consecutivos", () => {
    const input = '<tool name="a">{}</tool><tool name="b">{}</tool>Texto';
    const result = extractCleanText(input);
    expect(result).toBe("Texto");
  });

  it("debería manejar tags sin cierre consecutivos", () => {
    const input = '<tool name="a">{}</tool><tool name="b">{}</tool>Texto';
    const result = extractCleanText(input);
    expect(result).toBe("Texto");
  });

  it("debería trim el resultado final", () => {
    const input = '  <tool name="a">{}</tool>  Hola  <tool name="b">{}</tool>  ';
    const result = extractCleanText(input);
    expect(result).toBe("Hola");
  });

  it("debería manejar tags thinking/reasoning (no eliminar)", () => {
    const input = '<thinking>Pensamiento</thinking>Texto<tool name="a">{}</tool>Más';
    const result = extractCleanText(input);
    expect(result).toBe("<thinking>Pensamiento</thinking>TextoMás");
  });

  it("debería manejar tags malformados parciales", () => {
    const input = 'Texto<tool name="a">{ "path": "incompleto"';
    const result = extractCleanText(input);
    // El regex debería capturar hasta el final
    expect(result).toBe("Texto");
  });

  it("debería manejar tags con newlines en el JSON", () => {
    const input = 'Texto<tool name="a">{\n  "path": "test"\n}</tool>Más texto';
    const result = extractCleanText(input);
    expect(result).toBe("TextoMás texto");
  });

  it("debería manejar contenido con caracteres especiales HTML", () => {
    const input = 'Texto <tool name="a">{ "content": "<div>Hola</div>" }</tool>Más';
    const result = extractCleanText(input);
    expect(result).toBe("Texto Más");
  });
});

describe("Tool Parser - Casos integrados (collect + extract)", () => {
  it("debería procesar stream típico con tool call y texto", () => {
    const input = 'Voy a crear un archivo<tool name="createFile">{ "path": "test.txt", "content": "hola" }</tool>Listo';
    const calls = collectToolCalls(input);
    const clean = extractCleanText(input);
    
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("createFile");
    expect(clean).toBe("Voy a crear un archivoListo");
  });

  it("debería procesar stream incremental - tokens llegan uno a uno", () => {
    // Simula como el LLM emite tokens progresivamente
    const tokens = [
      '<',
      'tool',
      ' ',
      'name',
      '=',
      '"',
      'createFile',
      '"',
      '>',
      '{',
      ' ',
      '"',
      'path',
      '"',
      ':',
      ' ',
      '"',
      'test',
      '.',
      'txt',
      '"',
      '}',
      '<',
      '/',
      'tool',
      '>'
    ];
    
    const input = tokens.join('');
    const calls = collectToolCalls(input);
    const clean = extractCleanText(input);
    
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("createFile");
    expect(clean).toBe("");
  });

  describe("Stream progresivo - construcción del tag <tool> token por token", () => {
    it("debería filtrar correctamente mientras se construye el tag <tool> letra por letra - KNOWN ISSUE: tags parciales quedan en el texto", () => {
      // Caso crítico: mientras el tag se construye, NO debe aparecer en el chat
      const progressiveBuffers = [
        '<',                    // Incompleto
        '<t',                   // Incompleto
        '<to',                  // Incompleto
        '<too',                 // Incompleto
        '<tool',                // Incompleto (sin espacio)
        '<tool ',               // Incompleto
        '<tool n',              // Incompleto
        '<tool na',             // Incompleto
        '<tool nam',            // Incompleto
        '<tool name',           // Incompleto
        '<tool name=',          // Incompleto
        '<tool name="',         // Incompleto
        '<tool name="c',        // Incompleto
        '<tool name="cr',       // Incompleto
        '<tool name="cre',      // Incompleto
        '<tool name="crea',     // Incompleto
        '<tool name="creat',    // Incompleto
        '<tool name="create',   // Incompleto
        '<tool name="createF',  // Incompleto
        '<tool name="createFi', // Incompleto
        '<tool name="createFil', // Incompleto
        '<tool name="createFile"', // Incompleto (sin >)
        '<tool name="createFile">', // Incompleto (sin JSON)
        '<tool name="createFile">{', // Incompleto
        '<tool name="createFile">{ ', // Incompleto
        '<tool name="createFile">{ "', // Incompleto
        '<tool name="createFile">{ "p', // Incompleto
        '<tool name="createFile">{ "pa', // Incompleto
        '<tool name="createFile">{ "pat', // Incompleto
        '<tool name="createFile">{ "path', // Incompleto
        '<tool name="createFile">{ "path"', // Incompleto
        '<tool name="createFile">{ "path":', // Incompleto
        '<tool name="createFile">{ "path": ', // Incompleto
        '<tool name="createFile">{ "path": "', // Incompleto
        '<tool name="createFile">{ "path": "t', // Incompleto
        '<tool name="createFile">{ "path": "te', // Incompleto
        '<tool name="createFile">{ "path": "tes', // Incompleto
        '<tool name="createFile">{ "path": "test', // Incompleto
        '<tool name="createFile">{ "path": "test"', // Incompleto
        '<tool name="createFile">{ "path": "test."', // Incompleto
        '<tool name="createFile">{ "path": "test.t', // Incompleto
        '<tool name="createFile">{ "path": "test.tx', // Incompleto
        '<tool name="createFile">{ "path": "test.txt', // Incompleto
        '<tool name="createFile">{ "path": "test.txt"', // Incompleto
        '<tool name="createFile">{ "path": "test.txt" }', // Incompleto (sin cierre) - el lookahead lo elimina
        '<tool name="createFile">{ "path": "test.txt" }</', // Incompleto
        '<tool name="createFile">{ "path": "test.txt" }</t', // Incompleto
        '<tool name="createFile">{ "path": "test.txt" }</to', // Incompleto
        '<tool name="createFile">{ "path": "test.txt" }</too', // Incompleto
        '<tool name="createFile">{ "path": "test.txt" }</tool>', // COMPLETO
      ];

      // Este test documenta el problema: extractCleanText NO filtra tags parciales
      // El regex solo elimina tags completos o tags sin cierre con lookahead
      // Casos que NO se eliminan (el tag parcial queda en el texto):
      const partialTags = ['<', '<t', '<to', '<too', '<tool', '<tool ', '<tool n', '<tool na', '<tool nam', '<tool name', '<tool name=', '<tool name="'];
      
      for (const buffer of partialTags) {
        const clean = extractCleanText(buffer);
        // El tag parcial queda - este es el problema que causa que se pinte en el chat
        // Nota: extractCleanText hace trim() al final, así que los espacios se eliminan
        expect(clean.trim()).toBe(buffer.trim());
      }

      // Casos que SÍ se eliminan (tienen lookahead al final del string):
      const tagsWithLookahead = ['<tool name="a">{ }'];
      for (const buffer of tagsWithLookahead) {
        const clean = extractCleanText(buffer);
        expect(clean).toBe("");
      }

      // Tag completo se elimina
      const completeTag = '<tool name="a">{ }</tool>';
      const cleanComplete = extractCleanText(completeTag);
      expect(cleanComplete).toBe("");
    });

    it("debería filtrar correctamente mientras se construye el tag con texto antes", () => {
      const progressiveBuffers = [
        'Texto antes',
        'Texto antes<',
        'Texto antes<t',
        'Texto antes<to',
        'Texto antes<too',
        'Texto antes<tool',
        'Texto antes<tool ',
        'Texto antes<tool name',
        'Texto antes<tool name="',
        'Texto antes<tool name="a"',
        'Texto antes<tool name="a">',
        'Texto antes<tool name="a">{',
        'Texto antes<tool name="a">{ }',
        'Texto antes<tool name="a">{ }</',
        'Texto antes<tool name="a">{ }</t',
        'Texto antes<tool name="a">{ }</to',
        'Texto antes<tool name="a">{ }</too',
        'Texto antes<tool name="a">{ }</tool>',
      ];

      for (let i = 0; i < progressiveBuffers.length - 1; i++) {
        const buffer = progressiveBuffers[i];
        const clean = extractCleanText(buffer);
        
        // Mientras el tag está incompleto, el texto "Texto antes" debe mantenerse
        // pero el tag parcial puede filtrarse
        expect(clean).toContain("Texto antes");
      }

      const finalBuffer = progressiveBuffers[progressiveBuffers.length - 1];
      const finalClean = extractCleanText(finalBuffer);
      expect(finalClean).toBe("Texto antes");
    });

    it("debería filtrar correctamente mientras se construye el tag sin cierre - KNOWN ISSUE: tag parcial queda en el texto", () => {
      const progressiveBuffers = [
        '<',
        '<t',
        '<to',
        '<too',
        '<tool',
        '<tool ',
        '<tool name',
        '<tool name="',
        '<tool name="a"',
        '<tool name="a">', // Este se elimina por el lookahead al final
        '<tool name="a">{', // Este también se elimina por el lookahead al final
        '<tool name="a">{ }', // Este se elimina por el lookahead al final
        // Sin cierre al final - caso real del stream
      ];

      for (const buffer of progressiveBuffers) {
        const clean = extractCleanText(buffer);
        // KNOWN ISSUE: el tag parcial queda en el texto y se pinta en el chat
        // El regex solo elimina tags completos o con lookahead
        // Los que tienen lookahead al final ($) se eliminan
        if (buffer === '<tool name="a">' || buffer === '<tool name="a">{' || buffer === '<tool name="a">{ }') {
          // Estos tienen lookahead al final ($) así que se eliminan
          expect(clean).toBe("");
        } else {
          // Los tags parciales quedan - esto causa que se pinten en el chat
          // Nota: extractCleanText hace trim() al final
          expect(clean.trim()).toBe(buffer.trim());
        }
      }
    });

    it("debería filtrar correctamente mientras se construye múltiples tags", () => {
      const progressiveBuffers = [
        'Inicio',
        'Inicio<',
        'Inicio<t',
        'Inicio<tool',
        'Inicio<tool name',
        'Inicio<tool name="a"',
        'Inicio<tool name="a">{ }',
        'Inicio<tool name="a">{ }</',
        'Inicio<tool name="a">{ }</t',
        'Inicio<tool name="a">{ }</to',
        'Inicio<tool name="a">{ }</too',
        'Inicio<tool name="a">{ }</tool>',
        'Inicio<tool name="a">{ }</tool>Medio',
        'Inicio<tool name="a">{ }</tool>Medio<',
        'Inicio<tool name="a">{ }</tool>Medio<t',
        'Inicio<tool name="a">{ }</tool>Medio<to',
        'Inicio<tool name="a">{ }</tool>Medio<too',
        'Inicio<tool name="a">{ }</tool>Medio<tool',
        'Inicio<tool name="a">{ }</tool>Medio<tool name',
        'Inicio<tool name="a">{ }</tool>Medio<tool name="b"',
        'Inicio<tool name="a">{ }</tool>Medio<tool name="b">{ }',
        'Inicio<tool name="a">{ }</tool>Medio<tool name="b">{ }</',
        'Inicio<tool name="a">{ }</tool>Medio<tool name="b">{ }</t',
        'Inicio<tool name="a">{ }</tool>Medio<tool name="b">{ }</to',
        'Inicio<tool name="a">{ }</tool>Medio<tool name="b">{ }</too',
        'Inicio<tool name="a">{ }</tool>Medio<tool name="b">{ }</tool>',
        'Inicio<tool name="a">{ }</tool>Medio<tool name="b">{ }</tool>Fin',
      ];

      for (let i = 0; i < progressiveBuffers.length; i++) {
        const buffer = progressiveBuffers[i];
        const clean = extractCleanText(buffer);
        
        // Verificar que el texto alrededor ("Inicio", "Medio", "Fin") se mantiene
        if (buffer.includes("Inicio")) {
          expect(clean).toContain("Inicio");
        }
        if (buffer.includes("Medio")) {
          expect(clean).toContain("Medio");
        }
        if (buffer.includes("Fin")) {
          expect(clean).toContain("Fin");
        }
      }

      const finalBuffer = progressiveBuffers[progressiveBuffers.length - 1];
      const finalClean = extractCleanText(finalBuffer);
      expect(finalClean).toBe("InicioMedioFin");
    });

    it("KNOWN ISSUE: extractCleanText no filtra tags parciales durante el stream", () => {
      // Este test documenta el problema actual
      const partialTag = '<tool name="a"';
      const clean = extractCleanText(partialTag);
      
      // El problema: el tag parcial queda en el texto y se pinta en el chat
      // Solución: mejorar extractCleanText para detectar y ocultar tags en construcción
      expect(clean).toBe('<tool name="a"'); // Debería ser vacío o filtrado
    });

    it("debería detectar que un tag está en construcción y no filtrarlo al chat - FUNCION SUGERIDA", () => {
      // Este test documenta una función que DEBERÍA existir para resolver el problema
      // La función detectaría tags en construcción para ocultarlos del chat
      // Por ahora es solo una propuesta de solución
      
      function isToolTagInProgress(buffer: string): boolean {
        // Esta es una implementación sugerida que necesita refinamiento
        // El desafío es detectar tags parciales en cualquier posición del buffer
        // no solo al final
        
        // Caso especial: solo <
        if (buffer === '<') return true;
        
        // Casos simples: buffer que es SOLO el tag parcial
        const simplePatterns = [
          /^<t(?:oo|o?)?$/,
          /^<tool\s*$/,
          /^<tool\s+name\s*$/,
          /^<tool\s+name\s*=\s*$/,
          /^<tool\s+name\s*=\s*"[^"]*$/,
          /^<tool\s+name\s*=\s*"[^"]*"\s*$/,
          /^<tool\s+name\s*=\s*"[^"]*">\s*$/,
        ];
        
        for (const pattern of simplePatterns) {
          if (pattern.test(buffer)) return true;
        }
        
        // Caso con JSON pero sin cierre
        if (/^<tool\s+name\s*=\s*"[^"]*">\s*\{/.test(buffer) && !buffer.endsWith('}</tool>')) {
          return true;
        }
        
        // Caso específico: tiene JSON completo pero sin cierre de tag
        if (/^<tool\s+name\s*=\s*"[^"]*">\s*\{.*\}\s*$/.test(buffer) && !buffer.endsWith('}</tool>')) {
          return true;
        }
        
        return false;
      }

      // Test solo para buffers que son SOLO el tag (sin texto antes)
      const simpleTestCases = [
        { buffer: '<tool', expected: true },
        { buffer: '<tool ', expected: true },
        { buffer: '<tool name', expected: true },
        { buffer: '<tool name=', expected: true },
        { buffer: '<tool name="a"', expected: true },
        { buffer: '<tool name="a">', expected: true },
        { buffer: '<tool name="a">{ }', expected: true }, // Tiene JSON pero sin cierre de tag
        { buffer: '<tool name="a">{ }</tool>', expected: false },
        { buffer: '<', expected: true },
        { buffer: '<t', expected: true },
        { buffer: '<to', expected: true },
        { buffer: '<too', expected: true },
      ];

      for (const { buffer, expected } of simpleTestCases) {
        const result = isToolTagInProgress(buffer);
        expect(result).toBe(expected);
      }
    });
  });

  it("debería procesar stream con texto antes y después del tool call", () => {
    const input = 'Primero voy a crear<tool name="createFile">{ "path": "test.txt" }</tool>y luego listo';
    const calls = collectToolCalls(input);
    const clean = extractCleanText(input);
    
    expect(calls).toHaveLength(1);
    expect(clean).toBe("Primero voy a creary luego listo");
  });

  it("debería procesar stream con tool call duplicado mismo nombre", () => {
    const input = '<tool name="createFile">{ "path": "a.txt" }</tool><tool name="createFile">{ "path": "b.txt" }</tool>';
    const calls = collectToolCalls(input);
    const clean = extractCleanText(input);
    
    expect(calls).toHaveLength(2);
    expect(calls[0].args.path).toBe("a.txt");
    expect(calls[1].args.path).toBe("b.txt");
    expect(clean).toBe("");
  });

  it("debería procesar stream con tool call sin cierre", () => {
    const input = 'Creando archivo<tool name="createFile">{ "path": "test.txt" }';
    const calls = collectToolCalls(input);
    const clean = extractCleanText(input);
    
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("createFile");
    expect(clean).toBe("Creando archivo");
  });

  it("debería procesar stream con múltiples tool calls intercalados", () => {
    const input = 'Primero<tool name="a">{}</tool>después<tool name="b">{}</tool>final';
    const calls = collectToolCalls(input);
    const clean = extractCleanText(input);
    
    expect(calls).toHaveLength(2);
    expect(clean).toBe("Primerodespuésfinal");
  });

  it("debería procesar stream con tags thinking y tool calls", () => {
    const input = '<thinking>Necesito crear archivo</thinking><tool name="createFile">{ "path": "test.txt" }</tool>Hecho';
    const calls = collectToolCalls(input);
    const clean = extractCleanText(input);
    
    expect(calls).toHaveLength(1);
    expect(clean).toBe("<thinking>Necesito crear archivo</thinking>Hecho");
  });

  it("debería procesar stream con tool call duplicado mismo nombre", () => {
    const input = '<tool name="createFile">{ "path": "a.txt" }</tool><tool name="createFile">{ "path": "b.txt" }</tool>';
    const calls = collectToolCalls(input);
    const clean = extractCleanText(input);
    
    expect(calls).toHaveLength(2);
    expect(calls[0].args.path).toBe("a.txt");
    expect(calls[1].args.path).toBe("b.txt");
    expect(clean).toBe("");
  });

  it("debería procesar stream con tool call y texto con espacios", () => {
    const input = '  Voy a crear  <tool name="createFile">{ "path": "test.txt" }</tool>  archivo  ';
    const calls = collectToolCalls(input);
    const clean = extractCleanText(input);
    
    expect(calls).toHaveLength(1);
    expect(clean).toBe("Voy a crear    archivo"); // El trim final reduce pero los espacios intermedios se mantienen
  });

  it("debería manejar caso extremo: tool call incompleto al final - KNOWN ISSUE: SyntaxError", () => {
    const input = 'Texto<tool name="createFile">{ "path":';
    // El regex captura el JSON incompleto y JSON.parse falla
    expect(() => collectToolCalls(input)).toThrow(SyntaxError);
    const clean = extractCleanText(input);
    expect(clean).toBe("Texto");
  });

  it("debería manejar caso extremo: solo tag de cierre", () => {
    const input = 'Texto</tool>Más texto';
    const calls = collectToolCalls(input);
    const clean = extractCleanText(input);
    
    expect(calls).toHaveLength(0);
    expect(clean).toBe("TextoMás texto");
  });

  it("debería manejar tags anidados (no válidos pero que pueden aparecer) - KNOWN ISSUE: SyntaxError", () => {
    const input = '<tool name="a"><tool name="b">{}</tool></tool>';
    // El regex captura el contenido del primer tag que incluye el segundo tag
    // JSON.parse falla porque no es JSON válido
    expect(() => collectToolCalls(input)).toThrow(SyntaxError);
  });

  it("debería procesar stream con razonamiento y tool call", () => {
    const input = '<thinking>Necesito crear un archivo para guardar notas</thinking>Voy a crearlo<tool name="createFile">{ "path": "notas.txt", "content": "mis notas" }</tool>Listo';
    const calls = collectToolCalls(input);
    const clean = extractCleanText(input);
    
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("createFile");
    // extractCleanText NO elimina tags thinking
    expect(clean).toContain("<thinking>");
    expect(clean).toContain("Voy a crearlo");
    expect(clean).toContain("Listo");
  });

  it("debería procesar stream largo con múltiples operaciones", () => {
    const input = `
      Primero voy a crear varios archivos:
      <tool name="createFile">{ "path": "file1.txt", "content": "contenido 1" }</tool>
      <tool name="createFile">{ "path": "file2.txt", "content": "contenido 2" }</tool>
      <tool name="createFile">{ "path": "file3.txt", "content": "contenido 3" }</tool>
      Ahora voy a mover uno:
      <tool name="moveFolder">{ "source": "file1.txt", "destination": "archivos/file1.txt" }</tool>
      Por último elimino el tercero:
      <tool name="deleteFile">{ "path": "file3.txt" }</tool>
      Operaciones completadas.
    `;
    const calls = collectToolCalls(input);
    const clean = extractCleanText(input);
    
    expect(calls).toHaveLength(5);
    expect(calls[0].name).toBe("createFile");
    expect(calls[1].name).toBe("createFile");
    expect(calls[2].name).toBe("createFile");
    expect(calls[3].name).toBe("moveFolder");
    expect(calls[4].name).toBe("deleteFile"); // El último tiene cierre, debería capturarse
    expect(clean).toContain("Primero voy a crear varios archivos");
    expect(clean).toContain("Operaciones completadas");
  });

  it("debería procesar stream con tool call dentro de thinking tag - KNOWN ISSUE: tool capturado dentro de thinking", () => {
    const input = '<thinking>Necesito <tool name="createFile">{ "path": "test.txt" }</tool>crear archivo</thinking>Hecho';
    const calls = collectToolCalls(input);
    const clean = extractCleanText(input);
    
    // El regex captura el tool aunque esté dentro de thinking
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("createFile");
    // En producción, extractReasoningFromTags debería separar esto correctamente
  });

  it("debería procesar stream con tag reasoning alternativo", () => {
    const input = '<reasoning>Pensando en la solución</reasoning>El resultado es<tool name="ping">{}</tool>';
    const calls = collectToolCalls(input);
    const clean = extractCleanText(input);
    
    expect(calls).toHaveLength(1);
    expect(clean).toContain("<reasoning>");
    expect(clean).toContain("El resultado es");
  });
});
