import type { ChangeEventHandler } from "react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import type { LangOption } from "../utils/types";

interface Props
  extends React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > {
  langOption?: LangOption;
}

export const LanguageToggle: React.FC<Props> = ({ langOption }: Props) => {
  const { t, i18n } = useTranslation();

  const [lang, setLang] = useState<string>(i18n.language);

  const handleSelectLanguage: ChangeEventHandler<HTMLSelectElement> = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setLang(e.target.value);
    i18n.changeLanguage(e.target.value).catch((e) => console.log(e));
  };

  return (
    <div>
      <label>{t("changeLanguage", "Change Language")}</label>
      <select id="language" value={lang} onChange={handleSelectLanguage}>
        {Object.keys(langOption!).map((lng) => (
          <option
            key={lng}
            value={lng}
            style={{
              border: "1px solid #dfdfdf",
              boxSizing: "border-box",
              borderRadius: "4px",
              padding: "0 4px",
            }}
          >
            {langOption![lng]!.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
};
