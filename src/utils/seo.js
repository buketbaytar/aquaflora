export const seo = {
    setDefaults: () => {
        document.title = "DeepDive | Profesyonel Dalış ve Su Sporları Ekipmanları";
        seo.updateMeta('description', "En kaliteli dalış malzemeleri, zıpkınlar ve outdoor ekipmanları. Profesyonellerin tercihi DeepDive ile derinlikleri keşfedin.");
    },

    update: (title, description, image) => {
        document.title = `${title} | DeepDive`;
        if (description) seo.updateMeta('description', description);
        if (image) seo.updateMeta('og:image', image);
    },

    updateMeta: (name, content) => {
        let element = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);

        if (!element) {
            element = document.createElement('meta');
            if (name.startsWith('og:')) {
                element.setAttribute('property', name);
            } else {
                element.setAttribute('name', name);
            }
            document.head.appendChild(element);
        }

        element.setAttribute('content', content);
    },

    setJsonLd: (data) => {
        let script = document.querySelector('#json-ld');
        if (!script) {
            script = document.createElement('script');
            script.id = 'json-ld';
            script.type = 'application/ld+json';
            document.head.appendChild(script);
        }
        script.textContent = JSON.stringify(data);
    }
};
