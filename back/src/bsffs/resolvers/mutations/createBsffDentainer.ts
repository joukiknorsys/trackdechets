import { Prisma } from "@td/prisma";
import { checkIsAuthenticated } from "../../../common/permissions";
import type { MutationResolvers } from "@td/codegen-back";
import { prisma } from "@td/prisma";
import { graphqlInputToZodBsffDentainer } from "../../validation/bsff/helpers";
import { parseBsffDentainerAsync } from "../../validation/bsff";
import { expandBsffDentainerFromDb } from "../../converter";
import { checkHasSomePermission, Permission } from "../../../permissions";

const createBsffDentainerResolver: MutationResolvers["createBsffDainter"] =
  async (parent, { input }, context) => {
    const user = checkIsAuthenticated(context);
    await checkHasSomePermission(user, [
      Permission.BsdCanCreate,
      Permission.BsdCanUpdate
    ]);
    const zodDentainer = graphqlInputToZodBsffDentainer(input);
    // run validation, sirenify et recipify
    const { id, bsffId, ...parsed } = await parseBsffDentainerAsync(
      zodDentainer
    );

    const data: Prisma.BsffDentainerCreateInput = {
      ...parsed,
      // Set a default number to 0 as long as the dentainer is
      // not attached to a specific BSFF.
      number: 0
    };

    const dentainer = await prisma.bsffDentainer.create({
      data
    });
    return expandBsffDentainerFromDb(dentainer);
  };

export default createBsffDentainerResolver;
