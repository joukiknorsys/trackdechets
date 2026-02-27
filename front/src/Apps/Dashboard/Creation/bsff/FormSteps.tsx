import { useMutation, useQuery } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Bsff,
  BsdType,
  BsffType,
  Query,
  QueryBsffArgs,
  Mutation,
  MutationCreateBsffArgs,
  MutationUpdateBsffArgs,
  MutationCreateBsffTransporterArgs,
  MutationUpdateBsffTransporterArgs,
  BsffInput,
  BsffTransporterInput,
  TransportMode
} from "@td/codegen-ui";
import omitDeep from "omit-deep-lodash";
import React, { useMemo, useState, createContext, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader } from "../../../common/Components";
import FormStepsContent from "../FormStepsContent";

import {
  CREATE_DRAFT_BSFF,
  GET_BSFF_FORM,
  PUBLISH_BSFF,
  UPDATE_BSFF_FORM
} from "../../../common/queries/bsff/queries";
import { getComputedState } from "../getComputedState";
import {
  getErrorTabIds,
  getPublishErrorMessages,
  getPublishErrorTabIds,
  TabId
} from "../utils";
import { rawBsffSchema, ZodBsff } from "./schema"; // TODO
import initialState, {
  BsffValues,
  CreateOrUpdateBsffTransporterInput
} from "./utils/initial-state";
import TransporterBsff from "./steps/Transporter";
import DestinationBsff from "./steps/Destination";
import DetainerBsff from "./steps/Detainer";
import OperatorBsff from "./steps/Operator";
import WasteBsff from "./steps/Waste";
import {
  CREATE_BSDA_TRANSPORTER,
  CREATE_BSFF_DETAINER,
  CREATE_BSFF_TRANSPORTER,
  UPDATE_BSDA_TRANSPORTER,
  UPDATE_BSFF_DETAINER,
  UPDATE_BSFF_TRANSPORTER
} from "../../../Forms/Components/query";
import { isForeignVat } from "@td/constants";
import { toastApolloError } from "../toaster";
import { cleanPackagings } from "../../../Forms/Components/PackagingList/helpers";
import { isDefinedStrict } from "../../../../common/helper";
import { parseDate } from "../../../../common/datetime";

interface Props {
  bsdId?: string;
  publishErrorsFromRedirect?: {
    code: string;
    path: string[];
    message: string;
  }[];
}
export const BsffContext = createContext<Bsff | undefined>(undefined);

const BsffFormSteps = ({
  bsdId,
  publishErrorsFromRedirect
}: Readonly<Props>) => {
  const [publishErrors, setPublishErrors] = useState<
    | {
        code: string;
        path: string[];
        message: string;
      }[]
    | undefined
  >();

  const bsffQuery = useQuery<Pick<Query, "bsff">, QueryBsffArgs>(GET_BSFF_FORM, {
    variables: {
      id: bsdId!
    },
    skip: !bsdId,
    fetchPolicy: "network-only"
  });

  const sealedFields = useMemo(
    () =>
      (bsffQuery?.data?.bsff?.metadata?.fields?.sealed ?? [])
        ?.map(f => f.join("."))
        .filter(Boolean),
    [bsffQuery.data]
  );

  const [createBsff, { loading: creating }] = useMutation<
    Pick<Mutation, "createBsff">,
    MutationCreateBsffArgs
  >(CREATE_DRAFT_BSFF);

  const [publishBsff, { loading: publishing }] = useMutation<
    Pick<Mutation, "createBsff">,
    MutationCreateBsffArgs
  >(PUBLISH_BSFF);

  const [updateBsff, { loading: updating }] = useMutation<
    Pick<Mutation, "updateBsff">,
    MutationUpdateBsffArgs
  >(UPDATE_BSFF_FORM);

  const [createBsffTransporter, { loading: creatingBsffTransporter }] =
    useMutation<
      Pick<Mutation, "createBsffTransporter">,
      MutationCreateBsffTransporterArgs
    >(CREATE_BSFF_TRANSPORTER);

  const [updateBsffTransporter, { loading: updatingBsffTransporter }] =
    useMutation<
      Pick<Mutation, "updateBsffTransporter">,
      MutationUpdateBsffTransporterArgs
    >(UPDATE_BSFF_TRANSPORTER);

   const [createBsffDetainer, { loading: creatingBsffDetainer }] =
    useMutation<
      Pick<Mutation, "createBsffDetainer">,
      MutationCreateBsffDetainerArgs
    >(CREATE_BSFF_DETAINER);

  const [updateBsffDetainer, { loading: updatingBsffDetainer }] =
    useMutation<
      Pick<Mutation, "updateBsffDetainer">,
      MutationUpdateBsffDetainerArgs
    >(UPDATE_BSFF_DETAINER);

  const bsffState = useMemo(
    () =>
      getComputedState(initialState, bsffQuery.data?.bsff, [
        {
          path: "packagings",
          getComputedValue: (intialValue, actualValue) =>
            actualValue.length ? actualValue : intialValue
        },
        {
          path: "grouping",
          getComputedValue: (initialValue, actualValue) =>
            actualValue?.length ? actualValue : initialValue
        },
        {
          path: "forwarding",
          getComputedValue: (initialValue, actualValue) =>
            actualValue ?? initialValue
        },
        {
          path: "transporters",
          getComputedValue: (initialValue, actualValue) =>
            actualValue?.length ? actualValue : initialValue
        }
      ]),
    [bsffQuery.data]
  );

  const methods = useForm<ZodBsff>({
    values: bsffState,

    resolver: async (data, context, options) => {
      return zodResolver(rawBsffSchema)(data, context, options);
    }
  });
  const errorsFromPublishApi = publishErrors || publishErrorsFromRedirect;
  const publishErrorTabIds = getPublishErrorTabIds(
    BsdType.Bsff,
    errorsFromPublishApi
  );

  const formStateErrorsKeys = Object.keys(methods?.formState?.errors);
  const errorTabIds = getErrorTabIds(
    BsdType.Bsff,
    publishErrorTabIds,
    formStateErrorsKeys
  );
  const publishErrorMessages = useMemo(
    () => getPublishErrorMessages(BsdType.Bsff, errorsFromPublishApi),
    [errorsFromPublishApi]
  );

  useEffect(() => {
    for (const error of publishErrorMessages) {
      methods.setError(error.name as keyof ZodBsff, {
        type: "custom",
        message: error.message
      });
    }
  }, [publishErrorMessages, methods]);

  const [bsffContext, setBsffContext] = useState<Bsff | undefined>();

  const type = methods.watch("type");

  useEffect(() => {
    if (bsffQuery.data?.bsff?.id) {
      setBsffContext(bsffQuery.data.bsff);
    }
  }, [bsffQuery.data?.bsff]);

  const tabsContent = useMemo(
    () => ({
      waste: <WasteBsff />,
      emitter: <EmitterBsff />,
      worker: type === BsffType.OtherCollections ? <Worker /> : null,
      transporter: <TransporterBsff />,
      destination: <DestinationBsff />,
      other: <ActorsList />
    }),
    [type]
  );

  const loading =
    creating ||
    publishing ||
    updating ||
    creatingBsffTransporter ||
    updatingBsffTransporter ||
    creatingBsffDetainer ||
    updatingBsffDetainer;
  const mainCtaLabel = bsffState.id ? "Enregistrer" : "Publier";
  const draftCtaLabel = bsffState.id ? "" : "Enregistrer en brouillon";

  const cleanupFields = (input: BsffInput): BsffInput => {
    // When created through api, this field might be null in db
    // We send it as false at creation time from the UI, but we dont have any
    // mean to edit it, and it is locked once signed by worker
    // This can lead to unsolvable cases.
    // While waiting a better fix (eg. an editable field or to default the field as false),
    // this function unlocks users

    return omitDeep(input, "worker.work");
  };

  async function saveBsff(values: BsffInput, draft: boolean): Promise<any> {
    const bsffInput = await saveTransporters(values as BsffValues);

    // Careful. Legacy BSDAs have a `waste.isSubjectToADR` field
    // set to null, but the toggle is automatically set to true.
    const initialBsff = bsffQuery.data?.bsff;
    if (
      // If legacy BSDA...
      initialBsff?.waste?.isSubjectToADR === null &&
      // ...and the user did not change the toggle (nor the ADR value)
      bsffInput.waste?.isSubjectToADR === true &&
      (!isDefinedStrict(bsffInput.waste?.adr) ||
        bsffInput.waste?.adr === initialBsff.waste?.adr)
    ) {
      bsffInput.waste.isSubjectToADR = null;
    }

    const input = { ...bsffInput };

    const cleanInputTransporters =
      input.type === BsffType.Collection_2710
        ? // s'assure qu'on ne crée pas un transporteur "vide"
          // dans le cadre d'un BSDA de collecte en déchetterie
          // qui n'autorise pas l'ajout de transporteur
          { ...input, transporters: [] }
        : input;

    let cleanInput = omitDeep(cleanInputTransporters, [
      "isDraft",
      "ecoOrganisme.hasEcoOrganisme",
      "hasBroker",
      "hasIntermediaries",
      "emitter.company.city"
    ]);
    const worker = cleanInput.worker.isDisabled
      ? { ...cleanInput.worker }
      : cleanInput.worker.certification
      ? {
          ...cleanInput.worker,
          certification: {
            ...cleanInput.worker.certification,
            validityLimit: Boolean(
              cleanInput.worker?.certification?.validityLimit
            )
              ? parseDate(
                  cleanInput.worker?.certification?.validityLimit
                ).toISOString()
              : null
          }
        }
      : {
          isDisabled: false,
          company: cleanInput.worker.company,
          certification: {
            hasSubSectionFour: false,
            hasSubSectionThree: false,
            certificationNumber: "",
            validityLimit: null,
            organisation: ""
          }
        };

    const forwarding = cleanInput.forwarding?.id;
    const grouping = cleanInput.grouping?.map(g => g.id) ?? [];
    cleanInput = {
      ...cleanInput,
      worker,
      forwarding,
      grouping
    };

    if (bsffState.id) {
      return updateBsff({
        variables: { id: bsffState.id, input: cleanupFields(cleanInput) }
      });
    } else {
      if (draft) {
        return createBsff({ variables: { input: cleanInput } });
      } else {
        return publishBsff({ variables: { input: cleanInput } });
      }
    }
  }

  async function saveBsffTransporter(
    transporterInput: CreateOrUpdateBsffTransporterInput
  ): Promise<string> {
    const { id, transport, ...input } = transporterInput;

    // S'assure que les données de récépissé transport sont nulles dans les
    // cas suivants :
    // - l'exemption est cochée
    // - le transporteur est étranger
    // - le transport ne se fait pas par la route
    const cleanInput: BsffTransporterInput = {
      ...input,
      transport: {
        mode: transport?.mode,
        plates: transport?.plates
      },
      recepisse: {
        ...input.recepisse,
        validityLimit: !!input.recepisse?.validityLimit
          ? parseDate(input.recepisse.validityLimit).toISOString()
          : null,
        ...(input.recepisse?.isExempted ||
        isForeignVat(input?.company?.vatNumber) ||
        transport?.mode !== TransportMode.Road
          ? {
              number: null,
              validityLimit: null,
              department: null
            }
          : {})
      }
    };

    if (id) {
      // Le transporteur existe déjà en base de données, on met
      // à jour les infos (uniquement si le transporteur n'a pas encore
      // pris en charge le déchet) et on renvoie l'identifiant
      if (!transport?.takenOverAt) {
        const { errors } = await updateBsffTransporter({
          variables: { id, input: cleanInput },
          onError: err => {
            toastApolloError(err);
          }
        });
        if (errors) {
          throw new Error(errors.map(e => e.message).join("\n"));
        }
      }
      return id;
    } else {
      // Le transporteur n'existe pas encore en base, on le crée
      // et on renvoie l'identifiant retourné
      const { data, errors } = await createBsffTransporter({
        variables: { input: cleanInput },
        onError: err => {
          toastApolloError(err);
        }
      });
      if (errors) {
        throw new Error(errors.map(e => e.message).join("\n"));
      }
      // if `errors` is not defined then data?.createFormTransporter?.id
      // should be defined. For type safety we return "" if it is not, but
      // it should not hapen
      return data?.createBsffTransporter?.id ?? "";
    }
  }

  async function saveTransporters(values: BsffValues) {
    const { id, transporters, packagings, ...input } = values;
    let transporterIds: string[] = [];

    // we want to remove default transporters that are empty so as not to overcharge the db
    transporterIds = await Promise.all(
      transporters
        .filter(t => !!t.company?.siret || !!t.company?.vatNumber)
        .map(t => saveBsffTransporter(t))
    );

    const bsffInput: BsffInput = {
      ...input,
      transporters: transporterIds,
      packagings: cleanPackagings(packagings ?? [])
    };

    return bsffInput;
  }

  return (
    <BsffContext.Provider value={bsffContext}>
      <FormStepsContent
        bsdType={BsdType.Bsff}
        draftCtaLabel={draftCtaLabel}
        isLoading={loading}
        mainCtaLabel={mainCtaLabel}
        saveForm={saveBsff}
        useformMethods={methods}
        tabsContent={tabsContent}
        sealedFields={sealedFields}
        setPublishErrors={setPublishErrors}
        errorTabIds={errorTabIds}
        genericErrorMessage={publishErrorMessages.filter(
          error => error.tabId === TabId.none
        )}
      />
      {loading && <Loader />}
    </BsffContext.Provider>
  );
};

export default BsffFormSteps;
