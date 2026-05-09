import '@adonisjs/inertia/types'

import type { VNodeProps, AllowedComponentProps, ComponentInstance } from 'vue'

type ExtractProps<T> = Omit<
  ComponentInstance<T>['$props'],
  keyof VNodeProps | keyof AllowedComponentProps
>

declare module '@adonisjs/inertia/types' {
  export interface InertiaPages {
    'auth/login': ExtractProps<(typeof import('../../inertia/pages/auth/login.vue'))['default']>
    'catalog/categories/index': ExtractProps<(typeof import('../../inertia/pages/catalog/categories/index.vue'))['default']>
    'catalog/colors/index': ExtractProps<(typeof import('../../inertia/pages/catalog/colors/index.vue'))['default']>
    'catalog/locations/index': ExtractProps<(typeof import('../../inertia/pages/catalog/locations/index.vue'))['default']>
    'catalog/prints/index': ExtractProps<(typeof import('../../inertia/pages/catalog/prints/index.vue'))['default']>
    'catalog/sizes/index': ExtractProps<(typeof import('../../inertia/pages/catalog/sizes/index.vue'))['default']>
    'errors/not_found': ExtractProps<(typeof import('../../inertia/pages/errors/not_found.vue'))['default']>
    'errors/server_error': ExtractProps<(typeof import('../../inertia/pages/errors/server_error.vue'))['default']>
    'home': ExtractProps<(typeof import('../../inertia/pages/home.vue'))['default']>
    'movements/index': ExtractProps<(typeof import('../../inertia/pages/movements/index.vue'))['default']>
    'products/create': ExtractProps<(typeof import('../../inertia/pages/products/create.vue'))['default']>
    'products/edit': ExtractProps<(typeof import('../../inertia/pages/products/edit.vue'))['default']>
    'products/index': ExtractProps<(typeof import('../../inertia/pages/products/index.vue'))['default']>
    'products/show': ExtractProps<(typeof import('../../inertia/pages/products/show.vue'))['default']>
    'stock/adjust': ExtractProps<(typeof import('../../inertia/pages/stock/adjust.vue'))['default']>
    'stock/index': ExtractProps<(typeof import('../../inertia/pages/stock/index.vue'))['default']>
  }
}
