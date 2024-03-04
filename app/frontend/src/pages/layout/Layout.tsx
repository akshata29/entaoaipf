import { useRef, useState, useEffect } from "react";
import { Outlet, NavLink, Link } from "react-router-dom";
import { Checkbox, ChoiceGroup, IChoiceGroupOption, Panel, DefaultButton, Spinner, TextField, SpinButton, Stack, IPivotItemProps, getFadedOverflowStyle} from "@fluentui/react";

import github from "../../assets/github.svg"

import styles from "./Layout.module.css";
import { SettingsButton } from "../../components/SettingsButton/SettingsButton";


const Layout = () => {
    const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
    const [showAdmin, setShowAdmin] = useState<boolean>(false);

    const onShowAdmin = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setShowAdmin(!!checked);
    };

    return (
        <div className={styles.layout}>
            <header className={styles.header} role={"banner"}>
                <div className={styles.headerContainer}>
                    <Link to="https://dataaipdfchat.azurewebsites.net/" target={"_blank"} className={styles.headerTitleContainer}>
                        <h3 className={styles.headerTitle}>Chat and Ask using Prompt Flow</h3>
                    </Link>
                    <nav>
                        <ul className={styles.headerNavList}>
                            <li className={styles.headerNavLeftMargin}>
                                <NavLink to="/upload" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                Upload &nbsp;&nbsp;&nbsp;
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    Chat
                                </NavLink>
                            </li>
                            <li className={styles.headerNavLeftMargin}>
                                <NavLink to="/qa" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    Ask a question
                                </NavLink>
                            </li>
                            <li className={styles.headerNavLeftMargin}>
                                <NavLink to="/sql" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    Ask Sql
                                </NavLink>
                            </li>
                            {showAdmin && (
                                 <li className={styles.headerNavLeftMargin}>
                                 <NavLink to="/admin" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                     Admin
                                 </NavLink>
                             </li>
                            )}
                            <li className={styles.headerNavLeftMargin}>
                                <a href="https://github.com/akshata29/entaoaipf" target={"_blank"} title="Github repository link">
                                    <img
                                        src={github}
                                        alt="Github logo"
                                        aria-label="Link to github repository"
                                        width="20px"
                                        height="20px"
                                        className={styles.githubLogo}
                                    />
                                </a>
                            </li>
                            <li className={styles.headerNavLeftMargin}>
                                <SettingsButton className={styles.settingsButton} onClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)} />
                            </li>
                        </ul>
                    </nav>
                    <h4 className={styles.headerRightText}>Azure OpenAI</h4>
                </div>
            </header>
            <Panel
                headerText="Configure Page Settings"
                isOpen={isConfigPanelOpen}
                isBlocking={false}
                onDismiss={() => setIsConfigPanelOpen(false)}
                closeButtonAriaLabel="Close"
                onRenderFooterContent={() => <DefaultButton onClick={() => setIsConfigPanelOpen(false)}>Close</DefaultButton>}
                isFooterAtBottom={true}
            >
                <br/>
                <Checkbox
                    className={styles.chatSettingsSeparator}
                    checked={showAdmin}
                    label="Display Admin Features"
                    onChange={onShowAdmin}
                />
            </Panel>
            <Outlet />
        </div>
    );
};

export default Layout;
