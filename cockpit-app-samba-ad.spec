%global debug_package %{nil}

Name: cockpit-app-samba
Version: 1
Release: 1
Summary: Samba AD installer for Cockpit
License: LGPLv2+

Source: cockpit-app-samba-ad.tar.gz
BuildArch: noarch

Requires: samba-dc, cockpit

%description
Samba AD application for Cockpit eases Samba AD server deployment
by providing a visual way to construct Samba AD installer configuration
and initiate installation of Samba AD.

%prep
%setup -n cockpit-app-samba-ad

%build

%install
make install-only DESTDIR=%{buildroot}
find %{buildroot} -type f >> files.list
sed -i "s|%{buildroot}||" *.list
chmod a+x %{buildroot}/usr/libexec/cockpit-app-samba-ad-check-install

%files -f files.list
%dir %{_datadir}/cockpit/app-samba-ad
%doc README.md

%changelog
* Thu Jan 18 2018 - Alexander Bokovoy <abokovoy@redhat.com> - 1-1
- Initial release
