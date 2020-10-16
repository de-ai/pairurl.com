
import { Pages } from '../../../consts/uris';


export const RoutePaths = {
	CREATE  : Pages.CREATE,
	INVITE  : `${Pages.TEAM}/:teamSlug([a-z-0-9]+)/invite`,
	INVITED : `${Pages.INVITE}/:teamSlug([a-z-0-9]+)/:inviteID([0-9]+)/:timestamp([a-f0-9]+)`,
	PAYMENT : `${Pages.PAYMENT}/:sessionID([a-z-0-9]+)?`,
	PROFILE : Pages.PROFILE,
	PROJECT : `${Pages.TEAM}/:teamID([0-9]+)--:teamSlug([a-z-0-9]+)/project/:buildID([0-9]+)--:projectSlug([a-z-0-9]+)/:deviceSlug([a-z0-9-]+)/:componentID([0-9]+)?/:comments(comments)?/:commentID([0-9]+)?`,
	RECOVER : `${Pages.RECOVER}/:userID([0-9]+)/:timestamp([a-f0-9]+)`,
	TEAM    : `${Pages.TEAM}/:teamID([0-9]+)--:teamSlug([a-z-0-9]+)/:comments(comments)?/:commentID([0-9]+)?`,
	VERIFY  : `${Pages.VERIFY}/:userID([0-9]+)/:timestamp([a-f0-9]+)`
};

export { default } from './Routes';
