all:
	npm run build

install: all install-only

install-only:
	mkdir -p $(DESTDIR)/usr/libexec
	cp dist/samba-ad-check-install $(DESTDIR)/usr/libexec/cockpit-app-samba-ad-check-install
	chmod a+x $(DESTDIR)/usr/libexec/cockpit-app-samba-ad-check-install
	rm -f dist/samba-ad-check-install
	mkdir -p $(DESTDIR)/usr/share/cockpit
	cp -r dist/ $(DESTDIR)/usr/share/cockpit/app-samba-ad
	mkdir -p $(DESTDIR)/usr/share/metainfo/
	cp org.cockpit-project.app-samba-ad.metainfo.xml $(DESTDIR)/usr/share/metainfo/
	cp org.cockpit-project.app-samba-ad.64x64.png $(DESTDIR)/usr/share/metainfo/

clean:
	rm -rf dist/

EXTRA_DIST = \
	README.md \
	org.cockpit-project.app-samba-ad.metainfo.xml \
	org.cockpit-project.app-samba-ad.64x64.png \
	package.json \
        .eslintrc.json \
	webpack.config.js \
	webpack-with-stats \
	Makefile

cockpit-app-samba-ad.tar.gz: clean all
	tar czf cockpit-app-samba-ad.tar.gz --transform 's,^,cockpit-app-samba-ad/,' $$(cat webpack.inputs) package.json $(EXTRA_DIST) dist/

srpm: cockpit-app-samba-ad.tar.gz
	rpmbuild -bs \
	  --define "_sourcedir `pwd`" \
          --define "_srcrpmdir `pwd`" \
          cockpit-app-samba-ad.spec
