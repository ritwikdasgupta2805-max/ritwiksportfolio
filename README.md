# ritwiksportfolio

Source for [ritwiksportfolio.com](https://ritwiksportfolio.com), a static site in plain HTML, CSS and JS. It needs no build step.

## Editing

- `index.html` holds all the content. Search for `TODO` to find the placeholders.
- `styles.css` has the colors and layout. Change `--accent` in `:root` to re-theme.
- `assets/` holds images and files. Add `profile.jpg` and `resume.pdf` here.

To preview locally, run `python3 -m http.server` and open http://localhost:8000.

## Hosting

The site is served by GitHub Pages from the `main` branch. The `CNAME` file points it at `ritwiksportfolio.com`, and the DNS for that domain is managed at GoDaddy.

## Password-protected case studies

`value-perception.html`, `in-context-checkout.html` and `cart-offers.html` are encrypted. To edit one, unlock it,
make the change, then lock it again before committing (the password is not stored in this repository):

    node tools/protect.mjs unlock <password> value-perception.html
    node tools/protect.mjs lock   <password> value-perception.html
