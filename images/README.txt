This folder is where real images for the website should be placed.

The gallery section in index.html currently references these placeholder filenames:

  images/gallery-placeholder-1.jpg
  images/gallery-placeholder-2.jpg
  images/gallery-placeholder-3.jpg
  images/gallery-placeholder-4.jpg
  images/gallery-placeholder-5.jpg
  images/gallery-placeholder-6.jpg

None of these files exist yet, so the gallery will show broken image icons until
you add real photos.

To replace them:
1. Add your real image files to this folder (e.g. classroom-1.jpg, lab-2.jpg).
2. In index.html, update each <img src="..."> in the gallery section to point
   to your new filename.
3. Update each <img alt="..."> attribute with an accurate, specific description
   of that photo (this matters for accessibility and SEO).
4. Update the <figcaption> text next to each image with a real caption.

Recommended image specs:
- Format: .jpg or .webp (webp is smaller and loads faster)
- Aspect ratio: roughly 4:3 (the layout is already set up for this)
- Size: keep individual files under ~300KB where possible for fast loading
