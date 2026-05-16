# RunFlow Studio

Embeddable JavaScript SDK for adding RunFlow Studio to any website in minutes.

## Install

**Script tag** (no build step):

```html
<script src="https://cdn.runflow.io/studio.js"></script>
<script>
  RunflowStudio.mount('#studio', { apiKey: 'pk_...' });
</script>
```

**npm**:

```bash
npm install @runflow/studio
```

```ts
import { mount } from '@runflow/studio';

mount('#studio', { apiKey: 'pk_...' });
```

## Configuration

| Option   | Type     | Description                            |
| -------- | -------- | -------------------------------------- |
| `apiKey` | `string` | Publishable key from the RunFlow dashboard. |
| `theme`  | `'light' \| 'dark' \| 'auto'` | Optional. Defaults to `auto`. |
| `onEvent`| `(event) => void` | Optional. Listen for Studio events. |

## Links

- [Documentation](https://docs.runflow.io/studio)
- [Dashboard](https://app.runflow.io)

## License

MIT
