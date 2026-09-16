import sanitizeHtml from 'sanitize-html'

// Ни одно из пользовательских полей не должно содержать разметку:
// вырезаем теги целиком и экранируем то, что осталось
export default function sanitizeText(value: string): string {
    return sanitizeHtml(value, {
        allowedTags: [],
        allowedAttributes: {},
        disallowedTagsMode: 'recursiveEscape',
    }).trim()
}
