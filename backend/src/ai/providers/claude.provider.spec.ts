import { ServiceUnavailableException } from '@nestjs/common';
import { TipoPregunta } from '@prisma/client';
import { ClaudeProvider } from './claude.provider';

describe('ClaudeProvider', () => {
  const provider = new ClaudeProvider();
  const originalApiKey = process.env.AI_API_KEY;

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalApiKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = originalApiKey;
  });

  it('refuses generation when Claude has no API key', async () => {
    delete process.env.AI_API_KEY;

    await expect(
      provider.generateEvaluation({
        contenido:
          'La fotosíntesis transforma energía luminosa en energía química.',
        tiposPregunta: [TipoPregunta.OPCION_MULTIPLE],
        cantidadPreguntas: 1,
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('returns a validated question from Claude structured output', async () => {
    process.env.AI_API_KEY = 'test-key';
    const generated = {
      nombre: 'Evaluación de fotosíntesis',
      descripcion: 'Responde las preguntas sobre el proceso.',
      idioma: 'español',
      requiereConfirmacionIdioma: false,
      preguntas: [
        {
          tipo: TipoPregunta.OPCION_MULTIPLE,
          enunciado: '¿Qué fuente de energía utiliza la fotosíntesis?',
          puntaje: 1,
          opciones: [
            { texto: 'Luz solar', esCorrecta: true },
            { texto: 'Energía sonora', esCorrecta: false },
          ],
          espacios: [],
        },
      ],
    };
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [
            { type: 'tool_use', name: 'return_evaluation', input: generated },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(
      provider.generateEvaluation({
        contenido:
          'La fotosíntesis transforma energía luminosa en energía química.',
        tiposPregunta: [TipoPregunta.OPCION_MULTIPLE],
        cantidadPreguntas: 1,
      }),
    ).resolves.toEqual(generated);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rejects a response that does not contain the requested number of questions', async () => {
    process.env.AI_API_KEY = 'test-key';
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [
            {
              type: 'tool_use',
              name: 'return_evaluation',
              input: {
                nombre: 'Evaluación incompleta',
                descripcion: '',
                idioma: 'español',
                requiereConfirmacionIdioma: false,
                preguntas: [],
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(
      provider.generateEvaluation({
        contenido:
          'La fotosíntesis transforma energía luminosa en energía química.',
        tiposPregunta: [TipoPregunta.OPCION_MULTIPLE],
        cantidadPreguntas: 1,
      }),
    ).rejects.toThrow('Claude devolvió una evaluación incompleta');
  });
});
