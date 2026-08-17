import React from 'react';

const LangSwitch = () => {
  const { hostname } = window.location;
  if (hostname === 'localhost') return null;
  const en = window.location.href.replace(hostname, 'client.docs.nocobase.com');
  const ru = window.location.href.replace(hostname, 'docs-ru.nocobase.com');
  return (
    <span>
      <a href={en}>EN</a> | <a href={ru}>RU</a>
    </span>
  );
};

export default LangSwitch;
